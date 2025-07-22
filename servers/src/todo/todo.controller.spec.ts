import { Test, TestingModule } from '@nestjs/testing';
import { TodoController } from './todo.controller';
import { TodoService } from './todo.service';
import {
  CreateTodoRequestDto,
  CreateTodoResponseDto,
} from './dtos/create-todo.dto';
import {
  UpdateTodoRequestDto,
  UpdateTodoResponseDto,
} from './dtos/update-todo.dto';
import { GetTodoResponseDto } from './dtos/get-todo.dto';
import { TodoPriorityEnum, ToDoQueryEnum, TodoStatusEnum } from './enums';
import { InviteUserRequestDto } from './dtos/invite-user.dto';
import { UpdateUserRoleRequestDto } from './dtos/update-user-role.dto';
import { RemoveUserPermissionRequestDto } from './dtos/romve-user-permission.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Request } from 'express';
import { UserTodoRole } from '../user-todo/entities/user-todo.entity';
import { GetUserTodoRoleResponseDto } from './dtos/get-todo-user-role.dto';

describe('TodoController', () => {
  let controller: TodoController;
  let todoService: TodoService;
  let req: Request;

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
    createdAt: new Date('2025-07-20T09:00:00Z'),
    updatedAt: new Date('2025-07-20T09:00:00Z'),
    deletedAt: null,
    userTodos: [],
  };

  const mockTodo = {
    id: mockTodoId,
    uuid: mockTodoUuid,
    name: 'Test Todo',
    description: 'Test Description',
    dueDate: new Date(),
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    attributes: { tags: ['tag1', 'tag2'] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTodoUserRole = {
    role: UserTodoRole.EDITOR,
  };

  const mockCreateTodoRequestDto: CreateTodoRequestDto = {
    name: 'New Task',
    description: 'A new task to complete',
    dueDate: new Date('2025-12-31'),
    status: TodoStatusEnum.NOT_STARTED,
    priority: TodoPriorityEnum.HIGH,
    tags: ['work', 'urgent'],
  };

  const mockUpdateTodoRequestDto: UpdateTodoRequestDto = {
    name: 'Updated Task Name',
    status: TodoStatusEnum.COMPLETED,
  };

  const mockInviteUserRequestDto: InviteUserRequestDto = {
    email: 'invited@example.com',
    role: UserTodoRole.VIEWER,
  };

  const mockUpdateUserRoleRequestDto: UpdateUserRoleRequestDto = {
    email: 'target@example.com',
    role: UserTodoRole.EDITOR,
  };

  const mockRemoveUserPermissionRequestDto: RemoveUserPermissionRequestDto = {
    email: 'remove@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodoController],
      providers: [
        {
          provide: TodoService,
          useValue: {
            createTodo: jest.fn(),
            updateTodo: jest.fn(),
            getAuthorizedTodo: jest.fn(),
            softDelete: jest.fn(),
            inviteUserToTodo: jest.fn(),
            updateUserRole: jest.fn(),
            getTodoUserRole: jest.fn(),
            removeUserPermissionFromTodo: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TodoController>(TodoController);
    todoService = module.get<TodoService>(TodoService);
    req = { user: mockUser } as unknown as Request;
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- Create Todo ---
  describe('create', () => {
    it('should create a todo and return a CreateTodoResponseDto', async () => {
      (todoService.createTodo as jest.Mock).mockResolvedValue(mockTodo);

      const result = await controller.create(mockCreateTodoRequestDto, req);

      expect(todoService.createTodo).toHaveBeenCalledWith(
        mockCreateTodoRequestDto,
        mockUser.id,
      );
      expect(result).toEqual(plainToInstance(CreateTodoResponseDto, mockTodo));
    });
  });

  // --- Update Todo ---
  describe('update', () => {
    it('should update a todo and return an UpdateTodoResponseDto', async () => {
      const updatedTodo = { ...mockTodo, name: mockUpdateTodoRequestDto.name };
      (todoService.updateTodo as jest.Mock).mockResolvedValue(updatedTodo);

      const result = await controller.update(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        req,
      );

      expect(todoService.updateTodo).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUpdateTodoRequestDto,
        mockUser.id,
      );
      expect(result).toEqual(
        plainToInstance(UpdateTodoResponseDto, updatedTodo),
      );
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoService.updateTodo as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo not found.'),
      );

      await expect(
        controller.update(mockTodoUuid, mockUpdateTodoRequestDto, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (todoService.updateTodo as jest.Mock).mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to update this todo.',
        ),
      );

      await expect(
        controller.update(mockTodoUuid, mockUpdateTodoRequestDto, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // --- getAuthorizedTodo ---
  describe('getAuthorizedTodo', () => {
    it('should return a todo with default fields', async () => {
      (todoService.getAuthorizedTodo as jest.Mock).mockResolvedValue(mockTodo);

      const result = await controller.getAuthorizedTodo(mockTodoUuid, req);

      expect(todoService.getAuthorizedTodo).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
        [], // No fields specified in query
      );
      expect(result).toEqual(plainToInstance(GetTodoResponseDto, mockTodo));
    });

    it('should return a todo with specified fields', async () => {
      const partialTodo = { uuid: mockTodo.uuid, name: mockTodo.name };
      (todoService.getAuthorizedTodo as jest.Mock).mockResolvedValue(
        partialTodo,
      );

      const fieldsQuery = 'name,uuid';
      const result = await controller.getAuthorizedTodo(
        mockTodoUuid,
        req,
        fieldsQuery,
      );

      expect(todoService.getAuthorizedTodo).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
        ['name', 'uuid'],
      );
      expect(result).toEqual(plainToInstance(GetTodoResponseDto, partialTodo));
    });

    it('should throw BadRequestException for invalid fields', async () => {
      const invalidFieldsQuery = 'name,invalidField,uuid';
      const allowedFields = Object.values(ToDoQueryEnum).join(', ');

      await expect(
        controller.getAuthorizedTodo(mockTodoUuid, req, invalidFieldsQuery),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.getAuthorizedTodo(mockTodoUuid, req, invalidFieldsQuery),
      ).rejects.toThrow(
        `Invalid field(s) requested: invalidField. Allowed fields are: ${allowedFields}.`,
      );
      expect(todoService.getAuthorizedTodo).not.toHaveBeenCalled(); // Should not call service if fields are invalid
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoService.getAuthorizedTodo as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo not found.'),
      );

      await expect(
        controller.getAuthorizedTodo(mockTodoUuid, req),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (todoService.getAuthorizedTodo as jest.Mock).mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to access this todo.',
        ),
      );

      await expect(
        controller.getAuthorizedTodo(mockTodoUuid, req),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // --- Soft Delete Todo ---
  describe('softDelete', () => {
    it('should soft-delete a todo and return no content', async () => {
      (todoService.softDelete as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.softDelete(mockTodoUuid, req);

      expect(todoService.softDelete).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
      );
      expect(result).toBeUndefined(); // For HTTP 204 No Content
    });

    it('should throw NotFoundException if todo not found', async () => {
      (todoService.softDelete as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo not found.'),
      );

      await expect(controller.softDelete(mockTodoUuid, req)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      (todoService.softDelete as jest.Mock).mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to soft-delete this todo.',
        ),
      );

      await expect(controller.softDelete(mockTodoUuid, req)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // --- Invite User to Todo ---
  describe('inviteUserToTodo', () => {
    it('should invite a user to a todo', async () => {
      (todoService.inviteUserToTodo as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.inviteUserToTodo(
        mockTodoUuid,
        mockInviteUserRequestDto,
        req,
      );

      expect(todoService.inviteUserToTodo).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
        mockInviteUserRequestDto.email,
        mockInviteUserRequestDto.role,
      );
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException if todo or invited user not found', async () => {
      (todoService.inviteUserToTodo as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo or invited user not found.'),
      );

      await expect(
        controller.inviteUserToTodo(
          mockTodoUuid,
          mockInviteUserRequestDto,
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (todoService.inviteUserToTodo as jest.Mock).mockRejectedValue(
        new ForbiddenException('Only owner can invite users to a todo.'),
      );

      await expect(
        controller.inviteUserToTodo(
          mockTodoUuid,
          mockInviteUserRequestDto,
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if user already assigned', async () => {
      (todoService.inviteUserToTodo as jest.Mock).mockRejectedValue(
        new ConflictException('User already assigned to this todo.'),
      );

      await expect(
        controller.inviteUserToTodo(
          mockTodoUuid,
          mockInviteUserRequestDto,
          req,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- Update User Role on Todo ---
  describe('updateUserRoleOnTodo', () => {
    it('should update user role on a todo', async () => {
      (todoService.updateUserRole as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.updateUserRoleOnTodo(
        mockTodoUuid,
        mockUpdateUserRoleRequestDto,
        req,
      );

      expect(todoService.updateUserRole).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
        mockUpdateUserRoleRequestDto.email,
        mockUpdateUserRoleRequestDto.role,
      );
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException if todo or target user not found', async () => {
      (todoService.updateUserRole as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo or target user not found for this todo.'),
      );

      await expect(
        controller.updateUserRoleOnTodo(
          mockTodoUuid,
          mockUpdateUserRoleRequestDto,
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (todoService.updateUserRole as jest.Mock).mockRejectedValue(
        new ForbiddenException('Only owner can update user roles on a todo.'),
      );

      await expect(
        controller.updateUserRoleOnTodo(
          mockTodoUuid,
          mockUpdateUserRoleRequestDto,
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // --- Get User Role on Todo ---
  describe('getTodoUserRole', () => {
    it('should get a todo user role', async () => {
      (todoService.getTodoUserRole as jest.Mock).mockResolvedValue(
        mockTodoUserRole,
      );

      const result = await controller.getTodoUserRole(mockTodoUuid, req);

      expect(todoService.getTodoUserRole).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
      );
      expect(result).toEqual(
        plainToInstance(GetUserTodoRoleResponseDto, mockTodoUserRole),
      );
    });

    it('should throw NotFoundException if todo or target user not found', async () => {
      (todoService.getTodoUserRole as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo or target user not found for this todo.'),
      );

      await expect(
        controller.getTodoUserRole(mockTodoUuid, req),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Remove User Permission ---
  describe('removeUserPermission', () => {
    it('should remove user permission from a todo', async () => {
      (todoService.removeUserPermissionFromTodo as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.removeUserPermission(
        mockTodoUuid,
        mockRemoveUserPermissionRequestDto,
        req,
      );

      expect(todoService.removeUserPermissionFromTodo).toHaveBeenCalledWith(
        mockTodoUuid,
        mockUser.id,
        mockRemoveUserPermissionRequestDto.email,
      );
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException if todo or target user/permission not found', async () => {
      (todoService.removeUserPermissionFromTodo as jest.Mock).mockRejectedValue(
        new NotFoundException('Todo or target user/permission not found.'),
      );

      await expect(
        controller.removeUserPermission(
          mockTodoUuid,
          mockRemoveUserPermissionRequestDto,
          req,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      (todoService.removeUserPermissionFromTodo as jest.Mock).mockRejectedValue(
        new ForbiddenException('Only the owner can remove user permissions.'),
      );

      await expect(
        controller.removeUserPermission(
          mockTodoUuid,
          mockRemoveUserPermissionRequestDto,
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
