import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserRequestDto } from './dto/create-user.dto';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let usersRepository: Repository<User>;
  let configService: ConfigService;

  // Mock Data
  const mockUserId = 1;
  const mockUserUuid = 'mock-user-uuid-123';
  const mockUserEmail = 'test@example.com';
  const mockPlainPassword = 'plainPassword123';
  const mockHashedPassword = 'hashedPassword123';
  const mockSaltRounds = 10;

  const mockUser: User = {
    id: mockUserId,
    uuid: mockUserUuid,
    name: 'Test User',
    email: mockUserEmail,
    password: mockHashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userTodos: [],
  };

  const mockCreateUserDto: CreateUserRequestDto = {
    name: 'New User',
    email: 'newuser@example.com',
    password: mockPlainPassword,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    configService = module.get<ConfigService>(ConfigService);

    // Reset all mocks before each test
    (usersRepository.create as jest.Mock).mockReset();
    (usersRepository.save as jest.Mock).mockReset();
    (usersRepository.findOne as jest.Mock).mockReset();
    (bcrypt.hash as jest.Mock).mockReset();
    (configService.get as jest.Mock).mockReset();

    // Default mock for configService.get('SALT_ROUNDS')
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'SALT_ROUNDS') {
        return String(mockSaltRounds);
      }
      return undefined; // For other keys, return undefined
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new user with a hashed password', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(undefined); // No existing user
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword); // Mock password hashing
      (usersRepository.create as jest.Mock).mockReturnValue({
        ...mockCreateUserDto,
        password: mockHashedPassword,
      });
      (usersRepository.save as jest.Mock).mockResolvedValue(mockUser); // Return the saved user

      // Act
      const result = await service.create(mockCreateUserDto);

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockCreateUserDto.email },
      });
      expect(configService.get).toHaveBeenCalledWith('SALT_ROUNDS');
      expect(bcrypt.hash).toHaveBeenCalledWith(
        mockCreateUserDto.password,
        mockSaltRounds,
      );
      expect(usersRepository.create).toHaveBeenCalledWith({
        ...mockCreateUserDto,
        password: mockHashedPassword,
      });
      expect(usersRepository.save).toHaveBeenCalledWith({
        ...mockCreateUserDto,
        password: mockHashedPassword,
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException if email already registered', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(mockUser); // User already exists

      // Act & Assert
      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockCreateUserDto)).rejects.toThrow(
        'Email already registered.',
      );
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockCreateUserDto.email },
      });
      expect(bcrypt.hash).not.toHaveBeenCalled(); // Should not attempt to hash password
      expect(usersRepository.create).not.toHaveBeenCalled(); // Should not attempt to create user
      expect(usersRepository.save).not.toHaveBeenCalled(); // Should not attempt to save user
    });

    it('should use default salt rounds if SALT_ROUNDS config is missing or invalid', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(undefined);
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHashedPassword);
      (usersRepository.create as jest.Mock).mockReturnValue({
        ...mockCreateUserDto,
        password: mockHashedPassword,
      });
      (usersRepository.save as jest.Mock).mockResolvedValue(mockUser);

      // Mock configService.get to return undefined for SALT_ROUNDS
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'SALT_ROUNDS') {
          return undefined;
        }
        return undefined;
      });

      // Act
      await service.create(mockCreateUserDto);

      // Assert
      // It should call bcrypt.hash with the default '10' as salt rounds
      expect(bcrypt.hash).toHaveBeenCalledWith(
        mockCreateUserDto.password,
        10, // Default salt rounds
      );
    });
  });

  describe('findOneByEmail', () => {
    it('should return a user if found by email', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await service.findOneByEmail(mockUserEmail);

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUserEmail },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found by email', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findOneByEmail('nonexistent@example.com');

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findOneById', () => {
    it('should return a user if found by ID', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await service.findOneById(mockUserId);

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found by ID', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findOneById(999); // Non-existent ID

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
      });
      expect(result).toBeNull();
    });
  });

  describe('findOneByUuid', () => {
    it('should return a user if found by UUID', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await service.findOneByUuid(mockUserUuid);

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: mockUserUuid },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found by UUID', async () => {
      // Arrange
      (usersRepository.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await service.findOneByUuid('non-existent-uuid');

      // Assert
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { uuid: 'non-existent-uuid' },
      });
      expect(result).toBeNull();
    });
  });
});
