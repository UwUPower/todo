import { Test, TestingModule } from '@nestjs/testing';
import { UserTodoService } from './user-todo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTodo, UserTodoRole } from './entities/user-todo.entity';
import { NotFoundException } from '@nestjs/common';
import { Todo } from '../todo/entities/todo.entity';
import { TodoStatusEnum, TodoPriorityEnum } from '../todo/enums';

describe('UserTodoService', () => {
  let userTodoService: UserTodoService;
  let userTodoRepository: Repository<UserTodo>;

  // Mock Data
  const mockUserId = 1;
  const mockTodoId = 101;
  const mockUserUuid = 'mock-user-uuid-123';
  const mockTodoUuid = 'mock-todo-uuid-123';
  const mockUserEmail = 'test@example.com';

  const mockUser = {
    id: mockUserId,
    uuid: mockUserUuid,
    email: mockUserEmail,
    name: 'Test User',
    password: 'hashedPassword',
    createdAt: new Date('2025-07-20T09:00:00Z'),
    updatedAt: new Date('2025-07-20T09:00:00Z'),
    deletedAt: null,
    userTodos: [],
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

  const mockUserTodo: UserTodo = {
    id: 1,
    userId: mockUserId,
    todoId: mockTodoId,
    role: UserTodoRole.VIEWER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    user: mockUser,
    todo: mockTodo,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTodoService,
        {
          provide: getRepositoryToken(UserTodo),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(), // Mock softDelete method
          },
        },
      ],
    }).compile();

    userTodoService = module.get<UserTodoService>(UserTodoService);
    userTodoRepository = module.get<Repository<UserTodo>>(
      getRepositoryToken(UserTodo),
    );
  });

  it('should be defined', () => {
    expect(userTodoService).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new user-todo relation', async () => {
      (userTodoRepository.create as jest.Mock).mockReturnValue(mockUserTodo);
      (userTodoRepository.save as jest.Mock).mockResolvedValue(mockUserTodo);

      const result = await userTodoService.createUserTodo(
        mockUserId,
        mockTodoId,
        UserTodoRole.VIEWER,
      );

      expect(userTodoRepository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        todoId: mockTodoId,
        role: UserTodoRole.VIEWER,
      });
      expect(userTodoRepository.save).toHaveBeenCalledWith(mockUserTodo);
      expect(result).toEqual(mockUserTodo);
    });
  });

  describe('updateRole', () => {
    it('should update the role of an existing user-todo relation', async () => {
      const newRole = UserTodoRole.EDITOR;
      const updatedUserTodo = { ...mockUserTodo, role: newRole };
      (userTodoRepository.findOne as jest.Mock).mockResolvedValue(mockUserTodo);
      (userTodoRepository.save as jest.Mock).mockResolvedValue(updatedUserTodo);

      const result = await userTodoService.updateRole(
        mockUserId,
        mockTodoId,
        newRole,
      );

      expect(userTodoRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUserId, todoId: mockTodoId },
      });
      expect(userTodoRepository.save).toHaveBeenCalledWith(updatedUserTodo);
      expect(result).toEqual(updatedUserTodo);
    });

    it('should throw NotFoundException if user-todo relation not found', async () => {
      (userTodoRepository.findOne as jest.Mock).mockResolvedValue(undefined);

      await expect(
        userTodoService.updateRole(mockUserId, mockTodoId, UserTodoRole.EDITOR),
      ).rejects.toThrow(NotFoundException);
      await expect(
        userTodoService.updateRole(mockUserId, mockTodoId, UserTodoRole.EDITOR),
      ).rejects.toThrow(
        `UserTodo relation not found for userId ${mockUserId} and todoId ${mockTodoId}.`,
      );
    });
  });

  describe('findOne', () => {
    it('should return a user-todo relation if found', async () => {
      (userTodoRepository.findOne as jest.Mock).mockResolvedValue(mockUserTodo);

      const result = await userTodoService.getTodoByUserIdAndTodoId(
        mockUserId,
        mockTodoId,
      );

      expect(userTodoRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUserId, todoId: mockTodoId },
      });
      expect(result).toEqual(mockUserTodo);
    });

    it('should return null if user-todo relation not found', async () => {
      (userTodoRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await userTodoService.getTodoByUserIdAndTodoId(
        mockUserId,
        mockTodoId,
      );

      expect(userTodoRepository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUserId, todoId: mockTodoId },
      });
      expect(result).toBeNull();
    });
  });

  describe('removeUserPermission', () => {
    it('should soft delete a user-todo permission', async () => {
      (userTodoRepository.softDelete as jest.Mock).mockResolvedValue({
        affected: 1,
      });

      await userTodoService.removeUserPermission(mockUserId, mockTodoId);

      expect(userTodoRepository.softDelete).toHaveBeenCalledWith({
        userId: mockUserId,
        todoId: mockTodoId,
      });
    });

    it('should throw NotFoundException if no permission was deleted (affected 0)', async () => {
      (userTodoRepository.softDelete as jest.Mock).mockResolvedValue({
        affected: 0,
      });

      await expect(
        userTodoService.removeUserPermission(mockUserId, mockTodoId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        userTodoService.removeUserPermission(mockUserId, mockTodoId),
      ).rejects.toThrow('No permission has been deleted');
    });
  });
});
