import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRequestDto, LoginResponseDto } from './dto/login.dto';
import { UnauthorizedException, HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mock data
  const mockLoginRequestDto: LoginRequestDto = {
    email: 'test@example.com',
    password: 'password123',
  };

  const mockAccessToken = 'mock-jwt-access-token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(), // Mock the login method of AuthService
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Reset mocks before each test
    (authService.login as jest.Mock).mockReset();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return an access token on successful login', async () => {
      // Arrange
      (authService.login as jest.Mock).mockResolvedValue({
        accessToken: mockAccessToken,
      });

      // Act
      const result = await controller.login(mockLoginRequestDto);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(mockLoginRequestDto);
      expect(result).toEqual(
        plainToInstance(LoginResponseDto, { accessToken: mockAccessToken }),
      );
      // Verify the structure of the returned DTO
      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe(mockAccessToken);
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      // Arrange
      (authService.login as jest.Mock).mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      // Act & Assert
      await expect(controller.login(mockLoginRequestDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.login(mockLoginRequestDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(authService.login).toHaveBeenCalledWith(mockLoginRequestDto);
    });
  });
});
