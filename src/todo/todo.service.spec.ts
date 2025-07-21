import { Test, TestingModule } from '@nestjs/testing';
import { TodoService } from './todo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, IsNull } from 'typeorm';
import { Todo, TodoPriorityEnum, TodoStatusEnum } from './entities/todo.entity';
import { UserTodoService } from '../user-todo/user-todo.service';
import { UserService } from '../user/user.service';
import { UserTodoRole } from '../user-todo/entities/user-todo.entity';
import { CreateTodoRequestDto } from './dto/create-todo.dto';
import { UpdateTodoRequestDto } from './dto/update-todo.dto';
import { GetTodosRequestDto } from './dto/get-todos.dto';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SortOrderEnum, ToDosSortByEnum } from './enums';

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
  let service: TodoService;
  let todosRepository: Repository<Todo>;
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
            findOneByEmail: jest.fn(),
            findOneByUuid: jest.fn(), // Added for consistency, though not used in this service file
          },
        },
        {
          provide: UserTodoService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateRole: jest.fn(),
            removeUserPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TodoService>(TodoService);
    todosRepository = module.get<Repository<Todo>>(getRepositoryToken(Todo));
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
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new todo and assign owner', async () => {
      (todosRepository.create as jest.Mock).mockReturnValue(mockTodo);
      (todosRepository.save as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.create as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await service.create(mockCreateTodoRequestDto, mockUserId);

      expect(todosRepository.create).toHaveBeenCalledWith({
        name: mockCreateTodoRequestDto.name,
        description: mockCreateTodoRequestDto.description,
        dueDate: mockCreateTodoRequestDto.dueDate,
        status: mockCreateTodoRequestDto.status,
        priority: mockCreateTodoRequestDto.priority,
        attributes: { tags: mockCreateTodoRequestDto.tags },
      });
      expect(todosRepository.save).toHaveBeenCalledWith(mockTodo);
      expect(userTodoService.create).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
        UserTodoRole.OWNER,
      );
      expect(result).toEqual(mockTodo);
    });

    it('should create a new todo with empty tags if not provided in DTO', async () => {
      const dtoWithoutTags = { ...mockCreateTodoRequestDto, tags: undefined };
      const todoWithEmptyTags = { ...mockTodo, attributes: { tags: [] } };
      (todosRepository.create as jest.Mock).mockReturnValue(todoWithEmptyTags);
      (todosRepository.save as jest.Mock).mockResolvedValue(todoWithEmptyTags);
      (userTodoService.create as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await service.create(dtoWithoutTags, mockUserId);

      expect(todosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: { tags: [] },
        }),
      );
      expect(result).toEqual(todoWithEmptyTags);
    });
  });

  describe('update', () => {
    it('should update a todo if user is owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todosRepository.save as jest.Mock).mockResolvedValue({
        ...mockTodo,
        ...mockUpdateTodoRequestDto,
        attributes: { tags: mockUpdateTodoRequestDto.tags },
      });

      const result = await service.update(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        mockUserId,
      );

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
      expect(todosRepository.save).toHaveBeenCalledWith(
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
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      );
      (todosRepository.save as jest.Mock).mockResolvedValue({
        ...mockTodo,
        ...mockUpdateTodoRequestDto,
      });

      const result = await service.update(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        mockUserId,
      );

      expect(result.name).toBe(mockUpdateTodoRequestDto.name);
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.update(mockTodoUuid, mockUpdateTodoRequestDto, mockUserId),
      ).rejects.toThrow(NotFoundException);
      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
    });

    it('should throw ForbiddenException if user has no permission (viewer)', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoViewer,
      );

      await expect(
        service.update(mockTodoUuid, mockUpdateTodoRequestDto, mockUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
    });

    it('should throw ForbiddenException if userTodo relation not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.update(mockTodoUuid, mockUpdateTodoRequestDto, mockUserId),
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
      (todosRepository.findOne as jest.Mock).mockResolvedValue(
        todoWithExistingTags,
      );
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todosRepository.save as jest.Mock).mockImplementation((todo) =>
        Promise.resolve(todo),
      ); // Return the saved object

      const result = await service.update(
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
      (todosRepository.findOne as jest.Mock).mockResolvedValue(
        todoWithExistingTags,
      );
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todosRepository.save as jest.Mock).mockImplementation((todo) =>
        Promise.resolve(todo),
      ); // Return the saved object

      const result = await service.update(
        mockTodoUuid,
        updateDtoWithEmptyTags,
        mockUserId,
      );

      expect(result.attributes.tags).toEqual([]);
    });
  });

  describe('findOneByUuid', () => {
    it('should return a todo with default fields if no fields are specified', async () => {
      (todosRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: mockTodoId }) // For id lookup
        .mockResolvedValueOnce(mockTodo); // For actual todo lookup
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await service.findOneByUuid(mockTodoUuid, mockUserId);

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: ['id'],
      });
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodoId,
      );
      expect(todosRepository.findOne).toHaveBeenCalledWith({
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
      (todosRepository.findOne as jest.Mock)
        .mockResolvedValueOnce({ id: mockTodoId })
        .mockResolvedValueOnce(mockTodoWithOnlyRequestedFields);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );

      const result = await service.findOneByUuid(
        mockTodoUuid,
        mockUserId,
        requestedFields,
      );

      expect(todosRepository.findOne).toHaveBeenCalledWith({
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
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined); // No todo ID found

      await expect(
        service.findOneByUuid(mockTodoUuid, mockUserId),
      ).rejects.toThrow(NotFoundException);
      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid },
        select: ['id'],
      });
      expect(userTodoService.findOne).not.toHaveBeenCalled(); // Should not proceed to userTodoService
    });

    it('should throw ForbiddenException if user has no permission', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValueOnce({
        id: mockTodoId,
      });
      (userTodoService.findOne as jest.Mock).mockResolvedValue(undefined); // No userTodo relation

      await expect(
        service.findOneByUuid(mockTodoUuid, mockUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodoId,
      );
    });
  });

  describe('findAll', () => {
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
      const result = await service.findAll(mockUserId, mockListTodosDto);

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
      await service.findAll(mockUserId, dto);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(todo.name) LIKE LOWER(:name)',
        { name: '%test%' },
      );
    });

    it('should filter by uuid', async () => {
      const dto = { ...mockListTodosDto, uuid: mockTodoUuid };
      await service.findAll(mockUserId, dto);
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
      await service.findAll(mockUserId, dto);
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
      await service.findAll(mockUserId, dto);
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
      await service.findAll(mockUserId, dto);
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
      await service.findAll(mockUserId, dto);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('todo.name', 'ASC');
    });

    it('should return only specified fields', async () => {
      const dto = { ...mockListTodosDto, fields: 'name,uuid,tags' };
      await service.findAll(mockUserId, dto);
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
      await service.findAll(mockUserId, dto);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        expect.arrayContaining(['todo.id', 'todo.name', 'todo.dueDate']),
      );
    });

    it('should default to all fields if fields param is empty or invalid', async () => {
      const dto = { ...mockListTodosDto, fields: '' }; // Empty fields
      await service.findAll(mockUserId, dto);
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

  describe('softDelete', () => {
    it('should soft delete a todo if user is owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (todosRepository.softDelete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await service.softDelete(mockTodoUuid, mockUserId);

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      );
      expect(todosRepository.softDelete).toHaveBeenCalledWith(mockTodo.id);
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.softDelete(mockTodoUuid, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        service.softDelete(mockTodoUuid, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteUserToTodo', () => {
    const invitedUserEmail = 'invited@example.com';
    const invitedUser = { ...mockUser, id: 2, email: invitedUserEmail };

    it('should invite a user to a todo if owner has permission and user is not already assigned', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce(undefined); // No existing permission for invited user
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(invitedUser);
      (userTodoService.create as jest.Mock).mockResolvedValue({
        userId: invitedUser.id,
        todoId: mockTodo.id,
        role: UserTodoRole.VIEWER,
      });

      await service.inviteUserToTodo(
        mockTodoUuid,
        mockUserId,
        invitedUserEmail,
        UserTodoRole.VIEWER,
      );

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      ); // Owner check
      expect(userService.findOneByEmail).toHaveBeenCalledWith(invitedUserEmail);
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        invitedUser.id,
        mockTodo.id,
      ); // Existing permission check
      expect(userTodoService.create).toHaveBeenCalledWith(
        invitedUser.id,
        mockTodo.id,
        UserTodoRole.VIEWER,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        service.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if invited user not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(undefined); // Invited user not found

      await expect(
        service.inviteUserToTodo(
          mockTodoUuid,
          mockUserId,
          invitedUserEmail,
          UserTodoRole.VIEWER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if user is already assigned', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner)
        .mockResolvedValueOnce(mockUserTodoViewer); // Existing permission
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(invitedUser);

      await expect(
        service.inviteUserToTodo(
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
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce(targetUserTodo); // Target user's existing permission
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(targetUser);
      (userTodoService.updateRole as jest.Mock).mockResolvedValue({
        ...targetUserTodo,
        role: UserTodoRole.EDITOR,
      });

      await service.updateUserRole(
        mockTodoUuid,
        mockUserId,
        targetUserEmail,
        UserTodoRole.EDITOR,
      );

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.findOne).toHaveBeenCalledTimes(1);
      expect(userService.findOneByEmail).toHaveBeenCalledWith(targetUserEmail);
      expect(userTodoService.updateRole).toHaveBeenCalledWith(
        targetUser.id,
        mockTodo.id,
        UserTodoRole.EDITOR,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        service.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(undefined); // Target user not found

      await expect(
        service.updateUserRole(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
          UserTodoRole.EDITOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeUserPermissionFromTodo', () => {
    const targetUserEmail = 'target@example.com';
    const targetUser = { ...mockUser, id: 2, email: targetUserEmail };

    it('should remove user permission if calling user is owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock)
        .mockResolvedValueOnce(mockUserTodoOwner) // Owner permission check
        .mockResolvedValueOnce({
          userId: targetUser.id,
          todoId: mockTodo.id,
          role: UserTodoRole.VIEWER,
        }); // Target user permission
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(targetUser);
      (userTodoService.removeUserPermission as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await service.removeUserPermissionFromTodo(
        mockTodoUuid,
        mockUserId,
        targetUserEmail,
      );

      expect(todosRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockTodoUuid, deletedAt: IsNull() },
      });
      expect(userTodoService.findOne).toHaveBeenCalledWith(
        mockUserId,
        mockTodo.id,
      ); // Owner check
      expect(userService.findOneByEmail).toHaveBeenCalledWith(targetUserEmail);
      expect(userTodoService.removeUserPermission).toHaveBeenCalledWith(
        targetUser.id,
        mockTodo.id,
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        service.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if calling user is not owner', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoEditor,
      ); // Not owner

      await expect(
        service.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target user not found', async () => {
      (todosRepository.findOne as jest.Mock).mockResolvedValue(mockTodo);
      (userTodoService.findOne as jest.Mock).mockResolvedValue(
        mockUserTodoOwner,
      );
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(undefined); // Target user not found

      await expect(
        service.removeUserPermissionFromTodo(
          mockTodoUuid,
          mockUserId,
          targetUserEmail,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
