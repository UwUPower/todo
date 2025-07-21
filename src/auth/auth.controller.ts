import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginRequestDto, LoginResponseDto } from './dtos/login.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginRequestDto, description: 'User credentials for login' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in and JWT token issued.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() loginRequestDto: LoginRequestDto,
  ): Promise<LoginResponseDto> {
    const { accessToken } = await this.authService.login(loginRequestDto);
    return plainToInstance(LoginResponseDto, { accessToken });
  }
}
