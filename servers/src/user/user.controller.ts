import {
  Controller,
  Post,
  Body,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateUserRequestDto,
  CreateUserResponseDto,
} from './dtos/create-user.dto';
import { plainToInstance } from 'class-transformer';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger'; // Import Swagger decorators

@ApiTags('User')
@Controller('user')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly UserService: UserService) {}
  @ApiBody({
    type: CreateUserRequestDto,
    description: 'Data for creating a new user',
  })
  @ApiResponse({
    status: 201,
    description: 'The user has been successfully created.',
    type: CreateUserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Email already registered or invalid input.',
  })
  @Post()
  async createUser(@Body() createUserDto: CreateUserRequestDto) {
    const user = await this.UserService.createUser(createUserDto);
    return plainToInstance(CreateUserResponseDto, user);
  }
}
