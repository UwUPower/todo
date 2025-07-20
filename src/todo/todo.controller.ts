import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import {
  CreateTodoRequestDto,
  CreateTodoResponseDto,
} from './dto/create-todo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';

@ApiTags('Todo')
@ApiBearerAuth('JWT-auth')
@Controller('todo')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Post()
  @ApiBody({
    type: CreateTodoRequestDto,
    description: 'Data for creating a new todo item',
  })
  @ApiResponse({
    status: 201,
    description: 'The todo has been successfully created.',
    type: CreateTodoRequestDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async create(
    @Body() createTodoDto: CreateTodoRequestDto,
    @Req() req: Request,
  ): Promise<CreateTodoResponseDto> {
    const user = req.user as User;
    const todo = await this.todoService.create(createTodoDto, user.id);
    return plainToInstance(CreateTodoResponseDto, todo);
  }
}
