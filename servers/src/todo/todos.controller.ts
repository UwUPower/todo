import {
  Controller,
  UseGuards,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '../user/entities/user.entity';
import { GetTodoResponseDto } from './dtos/get-todo.dto';
import { ToDoQueryEnum } from './enums';
import {
  GetTodosRequestDto,
  PaginatedTodosResponseDto,
} from './dtos/get-todos.dto';

@ApiTags('Todos')
@ApiBearerAuth('JWT-auth')
@Controller('todos')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TodosController {
  constructor(private readonly todoService: TodoService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'A paginated list of todo items.',
    type: PaginatedTodosResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters.' })
  async getAuthorizedTodos(
    @Req() req: Request,
    @Query() getTodosRequestDto: GetTodosRequestDto,
  ): Promise<PaginatedTodosResponseDto> {
    const user = req.user as User;
    // Validate requested fields for return
    let fieldsArray: string[] = [];
    if (getTodosRequestDto.fields) {
      const allowedFields = Object.values(ToDoQueryEnum);
      fieldsArray = getTodosRequestDto.fields.split(',').map((f) => f.trim());
      const invalidFields = fieldsArray.filter(
        (field) => !allowedFields.includes(field as ToDoQueryEnum),
      );
      if (invalidFields.length > 0) {
        throw new BadRequestException(
          `Invalid field(s) requested for return: ${invalidFields.join(', ')}. Allowed fields are: ${allowedFields.join(', ')}.`,
        );
      }
    }

    const { data, total } = await this.todoService.getAuthorizedTodos(
      user.id,
      getTodosRequestDto,
    );

    return {
      data: plainToInstance(GetTodoResponseDto, data, {
        groups:
          fieldsArray.length > 0 ? fieldsArray : Object.values(ToDoQueryEnum), // Apply groups for selective serialization
      }),
      total,
      page: getTodosRequestDto.page || 1,
      limit: getTodosRequestDto.limit || 10,
    };
  }
}
