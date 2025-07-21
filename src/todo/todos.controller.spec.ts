import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodoService } from './todo.service';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GetTodoResponseDto } from './dtos/get-todo.dto';
import { SortOrderEnum, ToDoQueryEnum, ToDosSortByEnum } from './enums';
import { GetTodosRequestDto } from './dtos/get-todos.dto';

// Mock the JwtAuthGuard to allow requests to proceed without actual JWT validation
jest.mock('../auth/jwt-auth.guard', () => ({
  JwtAuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

describe('TodosController', () => {
  let controller: TodosController;
  let todoService: TodoService;

  // Mock Data
  const mockUserId = 1;
  const mockUserUuid = 'mock-user-uuid';
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

  const mockTodo = {
    id: 101,
    uuid: 'todo-uuid-1',
    name: 'Test Todo 1',
    description: 'Desc 1',
    dueDate: new Date(),
    status: 'NOT_STARTED',
    priority: 'MEDIUM',
    attributes: { tags: ['tag1'] },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockTodo2 = {
    id: 102,
    uuid: 'todo-uuid-2',
    name: 'Test Todo 2',
    description: 'Desc 2',
    dueDate: new Date(),
    status: 'COMPLETED',
    priority: 'HIGH',
    attributes: { tags: ['tag2'] },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockTodosList = [mockTodo, mockTodo2];
  const mockTotal = 2;

  const mockGetTodosRequestDto: GetTodosRequestDto = {
    page: 1,
    limit: 10,
    sortBy: ToDosSortByEnum.DUE_DATE,
    sortOrder: SortOrderEnum.DESC,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        {
          provide: TodoService,
          useValue: {
            findAll: jest.fn(), // Mock the findAll method
          },
        },
      ],
    }).compile();

    controller = module.get<TodosController>(TodosController);
    todoService = module.get<TodoService>(TodoService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    let req: Request;

    beforeEach(() => {
      req = { user: mockUser } as unknown as Request;
    });

    it('should return a paginated list of todos with default fields if no fields are specified', async () => {
      // Arrange
      (todoService.findAll as jest.Mock).mockResolvedValue({
        data: mockTodosList,
        total: mockTotal,
      });

      // Act
      const result = await controller.findAll(req, mockGetTodosRequestDto);

      // Assert
      expect(todoService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockGetTodosRequestDto,
      );
      expect(result.data.length).toBe(mockTodosList.length);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(mockGetTodosRequestDto.page);
      expect(result.limit).toBe(mockGetTodosRequestDto.limit);
      expect(result.data[0]).toEqual(
        plainToInstance(GetTodoResponseDto, mockTodo, {
          groups: Object.values(ToDoQueryEnum),
        }),
      );
    });

    it('should return a paginated list of todos with specified fields', async () => {
      // Arrange
      const fieldsToReturn = [
        ToDoQueryEnum.NAME,
        ToDoQueryEnum.UUID,
        ToDoQueryEnum.TAGS,
      ];
      const dtoWithFields = {
        ...mockGetTodosRequestDto,
        fields: fieldsToReturn.join(','),
      };

      // Mock the service to return partial data if it were to filter at service level
      // For controller test, we assume service returns full data and controller handles serialization
      (todoService.findAll as jest.Mock).mockResolvedValue({
        data: mockTodosList,
        total: mockTotal,
      });

      // Act
      const result = await controller.findAll(req, dtoWithFields);

      // Assert
      expect(todoService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        dtoWithFields,
      );
      const expectedPartialTodo = plainToInstance(
        GetTodoResponseDto,
        mockTodo,
        { groups: fieldsToReturn },
      );
      expect(result.data[0]).toEqual(expectedPartialTodo);
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('uuid');
      expect(result.data[0]).toHaveProperty('attributes');
    });

    it('should throw BadRequestException for invalid requested fields', async () => {
      // Arrange
      const invalidFields = 'name,invalidField,uuid';
      const dtoWithInvalidFields = {
        ...mockGetTodosRequestDto,
        fields: invalidFields,
      };
      const allowedFields = Object.values(ToDoQueryEnum).join(', ');

      // Act & Assert
      await expect(
        controller.findAll(req, dtoWithInvalidFields),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.findAll(req, dtoWithInvalidFields),
      ).rejects.toThrow(
        `Invalid field(s) requested for return: invalidField. Allowed fields are: ${allowedFields}.`,
      );
      expect(todoService.findAll).not.toHaveBeenCalled(); // Service should not be called
    });

    it('should handle service throwing an UnauthorizedException', async () => {
      // Arrange
      (todoService.findAll as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Unauthorized.'),
      );

      // Act & Assert
      await expect(
        controller.findAll(req, mockGetTodosRequestDto),
      ).rejects.toThrow(UnauthorizedException);
      expect(todoService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockGetTodosRequestDto,
      );
    });

    it('should handle service throwing a BadRequestException for invalid query params', async () => {
      // Arrange
      (todoService.findAll as jest.Mock).mockRejectedValue(
        new BadRequestException('Invalid query parameters.'),
      );

      // Act & Assert
      await expect(
        controller.findAll(req, mockGetTodosRequestDto),
      ).rejects.toThrow(BadRequestException);
      expect(todoService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockGetTodosRequestDto,
      );
    });
  });
});
