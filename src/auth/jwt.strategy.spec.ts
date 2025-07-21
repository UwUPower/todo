import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../user/entities/user.entity';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let userService: UserService;
  let configService: ConfigService;

  const mockUser: User = {
    id: 1,
    uuid: 'test-uuid-123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    userTodos: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'testsecret'; // Mock JWT_SECRET
              }
              return null;
            }),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOneByUuid: jest.fn(), // Mock the findOneByUuid method
          },
        },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    userService = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks before each test
    (userService.findOneByUuid as jest.Mock).mockReset();
    (configService.get as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(jwtStrategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return a partial user object if validation is successful', async () => {
      // Arrange
      const payload = { uuid: mockUser.uuid, email: mockUser.email };
      (userService.findOneByUuid as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await jwtStrategy.validate(payload);

      // Assert
      expect(userService.findOneByUuid).toHaveBeenCalledWith(mockUser.uuid);
      expect(result).toEqual({
        id: mockUser.id,
        uuid: mockUser.uuid,
        email: mockUser.email,
      });
    });

    it('should throw UnauthorizedException if user UUID is not found in payload', async () => {
      // Arrange
      const payload = { email: mockUser.email }; // Missing uuid

      // Act & Assert
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        'User UUID not found in token.',
      );
      expect(userService.findOneByUuid).not.toHaveBeenCalled(); // Should not attempt to find user
    });

    it('should throw UnauthorizedException if user is not found in the database', async () => {
      // Arrange
      const payload = {
        uuid: 'non-existent-uuid',
        email: 'nonexistent@example.com',
      };
      (userService.findOneByUuid as jest.Mock).mockResolvedValue(undefined); // User not found

      // Act & Assert
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(jwtStrategy.validate(payload)).rejects.toThrow(
        'User not found or invalid token.',
      );
      expect(userService.findOneByUuid).toHaveBeenCalledWith(payload.uuid);
    });

    it('should handle JWT_SECRET being undefined and fallback to default', async () => {
      // Arrange
      // Mock ConfigService.get to return undefined for JWT_SECRET
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') {
          return undefined; // Simulate missing env var
        }
        return null;
      });

      // Re-create strategy to pick up the mocked configService
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: ConfigService, useValue: configService }, // Use the mocked configService
          { provide: UserService, useValue: userService }, // Use the mocked userService
        ],
      }).compile();
      jwtStrategy = module.get<JwtStrategy>(JwtStrategy);

      const payload = { uuid: mockUser.uuid, email: mockUser.email };
      (userService.findOneByUuid as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await jwtStrategy.validate(payload);

      // Assert
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET'); // Check if it tried to get the secret
      expect(result).toEqual({
        id: mockUser.id,
        uuid: mockUser.uuid,
        email: mockUser.email,
      });
    });
  });
});
