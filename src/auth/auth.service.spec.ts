import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginRequestDto } from './dto/login.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    uuid: 'mock-user-uuid',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLoginRequestDto: LoginRequestDto = {
    email: 'test@example.com',
    password: 'plainPassword123',
  };

  const mockAccessToken = 'mockAccessToken';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findOneByEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks before each test
    (userService.findOneByEmail as jest.Mock).mockReset();
    (jwtService.sign as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return partial user data if email and password are valid', async () => {
      // Arrange
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // Password matches

      // Act
      const result = await authService.validateUser(
        mockLoginRequestDto.email,
        mockLoginRequestDto.password,
      );

      // Assert
      expect(userService.findOneByEmail).toHaveBeenCalledWith(
        mockLoginRequestDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        mockLoginRequestDto.password,
        mockUser.password,
      );
      expect(result).toEqual({
        id: mockUser.id,
        uuid: mockUser.uuid,
        email: mockUser.email,
      });
    });

    it('should return null if user is not found', async () => {
      // Arrange
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(undefined); // User not found

      // Act
      const result = await authService.validateUser(
        'nonexistent@example.com',
        'anyPassword',
      );

      // Assert
      expect(userService.findOneByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled(); // Should not attempt to compare password
      expect(result).toBeNull();
    });

    it('should return null if password does not match', async () => {
      // Arrange
      (userService.findOneByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Password does not match

      // Act
      const result = await authService.validateUser(
        mockLoginRequestDto.email,
        'wrongPassword',
      );

      // Assert
      expect(userService.findOneByEmail).toHaveBeenCalledWith(
        mockLoginRequestDto.email,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongPassword',
        mockUser.password,
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return an access token if credentials are valid', async () => {
      // Arrange
      // Mock validateUser to return a valid user (simulating successful validation)
      jest.spyOn(authService, 'validateUser').mockResolvedValue({
        id: mockUser.id,
        uuid: mockUser.uuid,
        email: mockUser.email,
      });
      (jwtService.sign as jest.Mock).mockReturnValue(mockAccessToken);

      // Act
      const result = await authService.login(mockLoginRequestDto);

      // Assert
      expect(authService.validateUser).toHaveBeenCalledWith(
        mockLoginRequestDto.email,
        mockLoginRequestDto.password,
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        uuid: mockUser.uuid,
        email: mockUser.email,
      }); // Payload should only contain uuid and email
      expect(result).toEqual({ accessToken: mockAccessToken });
    });

    it('should throw UnauthorizedException if validateUser returns null', async () => {
      // Arrange
      jest.spyOn(authService, 'validateUser').mockResolvedValue(null); // Simulate failed validation

      // Act & Assert
      await expect(authService.login(mockLoginRequestDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(mockLoginRequestDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(authService.validateUser).toHaveBeenCalledWith(
        mockLoginRequestDto.email,
        mockLoginRequestDto.password,
      );
      expect(jwtService.sign).not.toHaveBeenCalled(); // Token should not be signed
    });
  });
});
