import { Test, TestingModule } from '@nestjs/testing';
import { TodoService } from './todo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Todo } from './entities/todo.entity';
import { UserTodoService } from '../user-todo/user-todo.service';
import { UserService } from '../user/user.service';
import { UserTodo, UserTodoRole } from '../user-todo/entities/user-todo.entity';
import { CreateTodoRequestDto } from './dtos/create-todo.dto';
import { UpdateTodoRequestDto } from './dtos/update-todo.dto';
import { GetTodosRequestDto } from './dtos/get-todos.dto';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  SortOrderEnum,
  TodoPriorityEnum,
  ToDosSortByEnum,
  TodoStatusEnum,
} from './enums';

// Mock Constants (as they are external to the service logic being tested)
const MOCK_TODO_QUERY_ENUM_DB_FIELD_MAP = {
  uuid: 'uuid',
  name: 'name',
  description: 'description',
  dueDate: 'dueDate',
  status: 'status',
  priority: 'priority',
  tags: 'attributes', // Tags are derived from attributes
};

const MOCK_TODO_SORT_BY_ENUM_DB_FIELD_MAP = {
  [ToDosSortByEnum.DUE_DATE]: 'todo.dueDate',
  [ToDosSortByEnum.STATUS]: 'todo.status',
  [ToDosSortByEnum.NAME]: 'todo.name',
  [ToDosSortByEnum.PRIORITY]: 'todo.priority',
};

// Mock Data
const mockUserId = 1;
const mockUserUuid = 'mock-user-uuid';
const mockUserEmail = 'test@example.com';
const mockTodoUuid = 'mock-todo-uuid-123';
const mockTodoId = 101;

const mockUser = {
  id: mockUserId,
  uuid: mockUserUuid,
  email: mockUserEmail,
  name: 'Test User',
  password: 'hashedPassword',
};

const mockTodo: Todo = {
  id: mockTodoId,
  uuid: mockTodoUuid,
  name: 'Test Todo',
  description: 'Test Description',
  dueDate: new Date('2025-08-01T10:00:00Z'),
  status: TodoStatusEnum.NOT_STARTED,
  priority: TodoPriorityEnum.MEDIUM,
  attributes: { tags: ['tag1', 'tag2'] },
  createdAt: new Date('2025-07-20T09:00:00Z'),
  updatedAt: new Date('2025-07-20T09:00:00Z'),
  deletedAt: null,
  usersTodo: [],
};

const mockUserTodoOwner = {
  id: 1,
  userId: mockUserId,
  todoId: mockTodoId,
  role: UserTodoRole.OWNER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserTodoEditor = {
  id: 2,
  userId: mockUserId,
  todoId: mockTodoId,
  role: UserTodoRole.EDITOR,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserTodoViewer = {
  id: 3,
  userId: mockUserId,
  todoId: mockTodoId,
  role: UserTodoRole.VIEWER,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCreateTodoRequestDto: CreateTodoRequestDto = {
  name: 'New Todo',
  description: 'New Description',
  dueDate: new Date('2025-08-01T10:00:00Z'),
  status: TodoStatusEnum.NOT_STARTED,
  priority: TodoPriorityEnum.HIGH,
  tags: ['new', 'important'],
};

const mockUpdateTodoRequestDto: UpdateTodoRequestDto = {
  name: 'Updated Todo Name',
  status: TodoStatusEnum.COMPLETED,
  tags: ['updated', 'tag'],
};

describe('TodoService', () => {
  let todoService: TodoService;
  let todoRepository: Repository<Todo>;
  let userService: UserService;
  let userTodoService: UserTodoService;

  // Mock TypeORM QueryBuilder methods
  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoService,
        {
          provide: getRepositoryToken(Todo),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserByEmail: jest.fn(),
            getUserByUuid: jest.fn(), // Added for consistency, though not used in this service file
          },
        },
        {
          provide: UserTodoService,
          useValue: {
            createUserTodo: jest.fn(),
            getTodoByUserIdAndTodoId: jest.fn(),
            updateRole: jest.fn(),
            removeUserPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    todoService = module.get<TodoService>(TodoService);
    todoRepository = module.get<Repository<Todo>>(getRepositoryToken(Todo));
    userService = module.get<UserService>(UserService);
    userTodoService = module.get<UserTodoService>(UserTodoService);

    // Reset mocks for query builder
    mockQueryBuilder.innerJoin.mockClear();
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
    mockQueryBuilder.orderBy.mockClear();
    mockQueryBuilder.skip.mockClear();
    mockQueryBuilder.take.mockClear();
    mockQueryBuilder.select.mockClear();
    mockQueryBuilder.getManyAndCount.mockClear();
    mockQueryBuilder.getOne.mockClear();

    // Mock constants used in the file
    jest.mock('./consts', () => ({
      TODO_QUERY_ENUM_DB_FIELD_MAP: MOCK_TODO_QUERY_ENUM_DB_FIELD_MAP,
      TODO_SORT_BY_ENUM_DB_FIELD_MAP: MOCK_TODO_SORT_BY_ENUM_DB_FIELD_MAP,
    }));
  });

  it('should be defined', () => {
    expect(todoService).toBeDefined();
  });

  describe('create', () => {
    it('should create a new todo and assign owner', async () => {
      (todoRepository.create as jest.Mock).mockReturnValue(mockTodo);
      (todoRepository.save as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.createUserTodo as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await todoService.createTodo(
        mockCreateTodoRequestDto,
        mockUserId,
      );

      expect(todoRepository.create).toHaveBeenCalledWith({
        name: mockCreateTodoRequestDto.name,
        description: mockCreateTodoRequestDto.description,
        dueDate: mockCreateTodoRequestDto.dueDate,
        status: mockCreateTodoRequestDto.status,
        priority: mockCreateTodoRequestDto.priority,
        attributes: { tags: mockCreateTodoRequestDto.tags },
      });
      expect(todoRepository.save).toHaveBeenCalledWith(mockTodo);
      expect(userTodoService.createUserTodo).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
        UserTodoRole.OWNER,
      );
      expect(result).toEqual(mockTodo);
    });

    it('should create a new todo with empty tags if not provided in DTO', async () => {
      const dtoWithoutTags = { ...mockCreateTodoRequestDto, tags: undefined };
      const todoWithEmptyTags = { ...mockTodo, attributes: { tags: [] } };
      (todoRepository.create as jest.Mock).mockReturnValue(todoWithEmptyTags);
      (todoRepository.save as jest.Mock).mockResolvedValue(todoWithEmptyTags);
      (userTodoService.createUserTodo as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await todoService.createTodo(dtoWithoutTags, mockUserId);

      expect(todoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: { tags: [] },
        }),
      );
      expect(result).toEqual(todoWithEmptyTags);
    });
  });

  describe('update', () => {
    it('should update a todo if user is owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todoRepository.save as jest.Mock).mockResolvedValue({
        ...mockTodo,
        ...mockUpdateTodoRequestDto,
        attributes: { tags: mockUpdateTodoRequestDto.tags },
      });

      const result = await todoService.updateTodo(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        mockUserId,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
      expect(todoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockUpdateTodoRequestDto.name,
          status: mockUpdateTodoRequestDto.status,
          attributes: { tags: mockUpdateTodoRequestDto.tags },
        }),
      );
      expect(result.name).toBe(mockUpdateTodoRequestDto.name);
      expect(result.status).toBe(mockUpdateTodoRequestDto.status);
      expect(result.attributes.tags).toEqual(mockUpdateTodoRequestDto.tags);
    });

    it('should update a todo if user is editor', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      );
      (todoRepository.save as jest.Mock).mockResolvedValue({
        ...mockTodo,
        ...mockUpdateTodoRequestDto,
      });

      const result = await todoService.updateTodo(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        mockUserId,
      );

      expect(result.name).toBe(mockUpdateTodoRequestDto.name);
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.updateTodo(
          mockTodoUuid,
          mockUpdateTodoRequestDto,
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
    });

    it('should throw ForbiddenException if user has no permission (viewer)', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoViewer,
      );

      await expect(
        todoService.updateTodo(
          mockTodoUuid,
          mockUpdateTodoRequestDto,
          mockUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
    });

    it('should throw ForbiddenException if userTodo relation not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        undefined,
      );

      await expect(
        todoService.updateTodo(
          mockTodoUuid,
          mockUpdateTodoRequestDto,
          mockUserId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not change tags if tags is undefined in updateRequestTodoDto', async () => {
      const todoWithExistingTags = {
        ...mockTodo,
        attributes: { tags: ['existing'] },
      };
      const updateDtoWithoutTags = {
        ...mockUpdateTodoRequestDto,
        tags: undefined,
      };
      (todoRepository.findOne as jest.Mock).mockResolvedValue(
        todoWithExistingTags,
      );
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todoRepository.save as jest.Mock).mockImplementation((todo) =>
        Promise.resolve(todo),
      ); // Return the saved object

      const result = await todoService.updateTodo(
        mockTodoUuid,
        updateDtoWithoutTags,
        mockUserId,
      );

      expect(result.attributes.tags).toEqual(['existing']);
    });

    it('should set tags to empty array if tags is explicitly an empty array in updateRequestTodoDto', async () => {
      const todoWithExistingTags = {
        ...mockTodo,
        attributes: { tags: ['existing'] },
      };
      const updateDtoWithEmptyTags = { ...mockUpdateTodoRequestDto, tags: [] };
      (todoRepository.findOne as jest.Mock).mockResolvedValue(
        todoWithExistingTags,
      );
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todoRepository.save as jest.Mock).mockImplementation((todo) =>
        Promise.resolve(todo),
      ); // Return the saved object

      const result = await todoService.updateTodo(
        mockTodoUuid,
        updateDtoWithEmptyTags,
        mockUserId,
      );

      expect(result.attributes.tags).toEqual([]);
    });
  });

  describe('getAuthorizedTodo', () => {
    it('should return a todo with default fields if no fields are specified', async () => {
      (todoRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: mockTodoId }) // For id lookup
        .mockResolvedValueOnce(mockTodo); // For actual todo lookup
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await todoService.getAuthorizedTodo(
        mockTodoUuid,
        mockUserId,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: ['id'],
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodoId,
      );
      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: expect.arrayContaining([
          'uuid',
          'name',
          'description',
          'dueDate',
          'status',
          'priority',
          'attributes',
        ]),
      });
      expect(result).toEqual(
        expect.objectContaining({
          uuid: mockTodo.uuid,
          name: mockTodo.name,
          attributes: mockTodo.attributes,
        }),
      );
    });

    it('should return a todo with specified fields', async () => {
      const requestedFields = ['name', 'tags'];
      const mockTodoWithOnlyRequestedFields: Partial<Todo> = {
        name: mockTodo.name,
        uuid: mockTodo.uuid,
        attributes: { tags: ['tag1', 'tag2'] },
      };
      (todoRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: mockTodoId })
        .mockResolvedValueOnce(mockTodoWithOnlyRequestedFields);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await todoService.getAuthorizedTodo(
        mockTodoUuid,
        mockUserId,
        requestedFields,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: expect.arrayContaining([
          'name',
          'attributes', // 'attributes' included because 'tags' was requested
        ]),
      });
      expect(result).toEqual(
        expect.objectContaining({
          uuid: mockTodo.uuid, // uuid is always included in the returned object
          name: mockTodo.name,
          attributes: mockTodo.attributes,
        }),
      );
      expect(result).not.toHaveProperty('description'); // Should not have description if not requested
    });

    it('should throw NotFoundException if todo UUID not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined); // No todo ID found

      await expect(
        todoService.getAuthorizedTodo(mockTodoUuid, mockUserId),
      ).rejects.toThrow(NotFoundException);
      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: ['id'],
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).not.toHaveBeenCalled(); // Should not proceed to userTodoService
    });

    it('should throw ForbiddenException if user has no permission', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValueOnce({
        id: mockTodoId,
      });
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        undefined,
      ); // No userTodo relation

      await expect(
        todoService.getAuthorizedTodo(mockTodoUuid, mockUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodoId,
      );
    });
  });

  describe('getAuthorizedTodos', () => {
    const mockListTodosDto: GetTodosRequestDto = {
      page: 1,
      limit: 10,
      sortBy: ToDosSortByEnum.DUE_DATE,
      sortOrder: SortOrderEnum.DESC,
    };

    const mockTodosList = [
      mockTodo,
      { ...mockTodo, id: 102, uuid: 'another-uuid', name: 'Another Todo' },
    ];

    beforeEach(() => {
      (mockQueryBuilder.getManyAndCount as jest.Mock).mockResolvedValue([
        mockTodosList,
        mockTodosList.length,
      ]);
    });

    it('should return a paginated list of todos with default filters and sort', async () => {
      const result = await todoService.getAuthorizedTodos(
        mockUserId,
        mockListTodosDto,
      );

      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'users_todos',
        'userTodo',
        'userTodo.todoId = todo.id AND userTodo.userId = :userId AND userTodo.deletedAt IS NULL',
        { userId: mockUserId },
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'todo.deletedAt IS NULL',
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'todo.dueDate',
        'DESC',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          'todo.id',
          'todo.uuid',
          'todo.name',
          'todo.description',
          'todo.dueDate',
          'todo.status',
          'todo.priority',
          'todo.attributes',
        ]),
      );
      expect(result.data).toEqual(mockTodosList);
      expect(result.total).toBe(mockTodosList.length);
    });

    it('should filter by name (wildcard)', async () => {
      const dto = { ...mockListTodosDto, name: 'test' };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(todo.name) LIKE LOWER(:name)',
        { name: '%test%' },
      );
    });

    it('should filter by uuid', async () => {
      const dto = { ...mockListTodosDto, uuid: mockTodoUuid };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'todo.uuid = :uuid',
        { uuid: mockTodoUuid },
      );
    });

    it('should filter by dueDateAfter and dueDateBefore', async () => {
      const dto = {
        ...mockListTodosDto,
        dueDateAfter: '2025-07-20',
        dueDateBefore: '2025-07-25',
      };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'todo.dueDate BETWEEN :after AND :before',
        expect.objectContaining({
          after: expect.any(Date),
          before: expect.any(Date),
        }),
      );
    });

    it('should filter by status and priority', async () => {
      const dto = {
        ...mockListTodosDto,
        status: TodoStatusEnum.COMPLETED,
        priority: TodoPriorityEnum.HIGH,
      };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'todo.status = :status',
        { status: TodoStatusEnum.COMPLETED },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'todo.priority = :priority',
        { priority: TodoPriorityEnum.HIGH },
      );
    });

    it('should filter by tags', async () => {
      const dto = { ...mockListTodosDto, tags: 'tag1,tag3' };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        `(todo.attributes->'tags') ?| :tags`,
        { tags: ['tag1', 'tag3'] },
      );
    });

    it('should sort by specified field and order', async () => {
      const dto = {
        ...mockListTodosDto,
        sortBy: ToDosSortByEnum.NAME,
        sortOrder: SortOrderEnum.ASC,
      };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('todo.name', 'ASC');
    });

    it('should return only specified fields', async () => {
      const dto = { ...mockListTodosDto, fields: 'name,uuid,tags' };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          'todo.id',
          'todo.name',
          'todo.uuid',
          'todo.attributes', // attributes included because tags was requested
        ]),
      );
      expect(mockQueryBuilder.select).not.toHaveBeenCalledWith(
        expect.arrayContaining(['todo.description']),
      );
    });

    it('should always include sort field in select fields even if not explicitly requested', async () => {
      const dto = {
        ...mockListTodosDto,
        sortBy: ToDosSortByEnum.DUE_DATE,
        fields: 'name',
      };
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining(['todo.id', 'todo.name', 'todo.dueDate']),
      );
    });

    it('should default to all fields if fields param is empty or invalid', async () => {
      const dto = { ...mockListTodosDto, fields: '' }; // Empty fields
      await todoService.getAuthorizedTodos(mockUserId, dto);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          'todo.id',
          'todo.uuid',
          'todo.name',
          'todo.description',
          'todo.dueDate',
          'todo.status',
          'todo.priority',
          'todo.attributes',
        ]),
      );
    });
  });

  describe('softDeleteTodo', () => {
    it('should soft delete a todo if user is owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todoRepository.softDelete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await todoService.softDelete(mockTodoUuid, mockUserId);

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
      expect(todoRepository.softDelete).toHaveBeenCalledWith(mockTodo.id);
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.softDelete(mockTodoUuid, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        todoService.softDelete(mockTodoUuid, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteUserToTodo', () => {
    const invitedUserEmail = 'invited@example.com';
    const invitedUser = { ...mockUser, id: 2, email: invitedUserEmail };

    it('should invite a user to a todo if owner has permission and user is not already assigned', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce(undefined); // No existing permission for invited user
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(invitedUser);
      (userTodoService.createUserTodo as jest.Mock).mockResolvedValue({
        userId: invitedUser.id,
        todoId: mockTodo.id,
        role: UserTodoRole.VIEWER,
      });

      await todoService.inviteUserToTodo(
        mockTodoUuid,
        mockUserId,
        invitedUserEmail,
        UserTodoRole.VIEWER,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      ); // Owner check
      expect(userService.getUserByEmail).toHaveBeenCalledWith(invitedUserEmail);
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        invitedUser.id,
        mockTodo.id,
      ); // Existing permission check
      expect(userTodoService.createUserTodo).toHaveBeenCalledWith(
        invitedUser.id,
        mockTodo.id,
        UserTodoRole.VIEWER,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        todoService.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if invited user not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(undefined); // Invited user not found

      await expect(
        todoService.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user is already assigned', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner)
        .mockResolvedValueOnce(mockUserTodoViewer); // Existing permission
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(invitedUser);

      await expect(
        todoService.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateUserRole', () => {
    const targetUserEmail = 'target@example.com';
    const targetUser = { ...mockUser, id: 2, email: targetUserEmail };
    const targetUserTodo = { ...mockUserTodoViewer, userId: targetUser.id };

    it('should update user role if calling user is owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce(targetUserTodo); // Target user's existing permission
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(targetUser);
      (userTodoService.updateRole as jest.Mock).mockResolvedValue({
        ...targetUserTodo,
        role: UserTodoRole.EDITOR,
      });

      await todoService.updateUserRole(
        mockTodoUuid,
        mockUserId,
        targetUserEmail,
        UserTodoRole.EDITOR,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledTimes(1);
      expect(userService.getUserByEmail).toHaveBeenCalledWith(targetUserEmail);
      expect(userTodoService.updateRole).toHaveBeenCalledWith(
        targetUser.id,
        mockTodo.id,
        UserTodoRole.EDITOR,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        todoService.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(undefined); // Target user not found

      await expect(
        todoService.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTodoUserRole', () => {
    it('should get user role', async () => {
      (
        userTodoService.getTodoByUserIdAndTodoId as jest.Mock
      ).mockResolvedValueOnce({
        ...mockTodo,
        role: UserTodoRole.EDITOR,
      });

      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);

      const { role } = await todoService.getTodoUserRole(
        mockTodoUuid,
        mockUserId,
      );

      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledTimes(1);
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodoId,
      );
      expect(role).toEqual(UserTodoRole.EDITOR);
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.getTodoUserRole(mockTodoUuid, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeUserPermissionFromTodo', () => {
    const targetUserEmail = 'target@example.com';
    const targetUser = { ...mockUser, id: 2, email: targetUserEmail };

    it('should remove user permission if calling user is owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce({
          userId: targetUser.id,
          todoId: mockTodo.id,
          role: UserTodoRole.VIEWER,
        }); // Target user permission
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(targetUser);
      (userTodoService.removeUserPermission as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await todoService.removeUserPermissionFromTodo(
        mockTodoUuid,
        mockUserId,
        targetUserEmail,
      );

      expect(todoRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.getTodoByUserIdAndTodoId).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      ); // Owner check
      expect(userService.getUserByEmail).toHaveBeenCalledWith(targetUserEmail);
      expect(userTodoService.removeUserPermission).toHaveBeenCalledWith(
        targetUser.id,
        mockTodo.id,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        todoService.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        todoService.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user not found', async () => {
      (todoRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.getTodoByUserIdAndTodoId as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.getUserByEmail as jest.Mock).mockResolvedValue(undefined); // Target user not found

      await expect(
        todoService.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
