import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
  Patch,
  Param,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import {
  CreateTodoRequestDto,
  CreateTodoResponseDto,
} from './dto/create-todo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/user/entities/user.entity';
import {
  UpdateTodoRequestDto,
  UpdateTodoResponseDto,
} from './dto/update-todo.dto';

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

  @Patch(':uuid') // Using Patch for partial updates
  @ApiParam({ name: 'uuid', description: 'UUID of the todo item to update.' })
  @ApiBody({
    type: UpdateTodoRequestDto,
    description: 'Data for updating an existing todo item',
  })
  @ApiResponse({
    status: 200,
    description: 'The todo has been successfully updated.',
    type: UpdateTodoResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden: User does not have permission to update this todo.',
  })
  @ApiResponse({ status: 404, description: 'Todo not found.' })
  async update(
    @Param('uuid') uuid: string,
    @Body() updateTodoRequestDto: UpdateTodoRequestDto,
    @Req() req: Request,
  ): Promise<UpdateTodoResponseDto> {
    const user = req.user as User;
    const todo = await this.todoService.update(
      uuid,
      updateTodoRequestDto,
      user.id,
    );
    return plainToInstance(UpdateTodoResponseDto, todo);
  }
}
