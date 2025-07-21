import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
} from './dtos/create-user.dto';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService; // Renamed to follow convention

  // Mock Data
  const mockCreateUserRequestDto: CreateUserRequestDto = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  const mockUser = {
    id: 1,
    uuid: 'mock-uuid-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a user and return a CreateUserResponseDto', async () => {
      // Arrange
      (userService.createUser as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await controller.createUser(mockCreateUserRequestDto);

      // Assert
      expect(userService.createUser).toHaveBeenCalledWith(
        mockCreateUserRequestDto,
      );
      // Ensure the response is transformed correctly using plainToInstance
      expect(result).toEqual(plainToInstance(CreateUserResponseDto, mockUser));
      expect(result).toHaveProperty('uuid', mockUser.uuid);
      expect(result).toHaveProperty('email', mockUser.email);
    });

    it('should throw BadRequestException if user creation fails (e.g., email already registered)', async () => {
      // Arrange
      (userService.createUser as jest.Mock).mockRejectedValue(
        new BadRequestException('Email already registered.'),
      );

      // Act & Assert
      await expect(
        controller.createUser(mockCreateUserRequestDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createUser(mockCreateUserRequestDto),
      ).rejects.toThrow('Email already registered.');
      expect(userService.createUser).toHaveBeenCalledWith(
        mockCreateUserRequestDto,
      );
    });
  });
});
