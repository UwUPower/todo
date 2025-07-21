import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { TodoStatusEnum, TodoPriorityEnum } from '../entities/todo.entity';
import { SortOrderEnum, ToDosSortByEnum } from '../enums';
import { GetTodoResponseDto } from './get-todo.dto';

export class GetTodosRequestDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination.',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page for pagination.',
    example: 10,
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search term to filter todos by name (wildcard).',
    example: 'buy groceries',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter todos by UUID.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsOptional()
  uuid?: string;

  @ApiPropertyOptional({
    description: 'Due date after (inclusive), format YYYY-MM-DD',
    example: '2025-01-01',
  })
  @IsString()
  @IsOptional()
  dueDateAfter?: string;

  @ApiPropertyOptional({
    description: 'Due date before (inclusive), format YYYY-MM-DD',
    example: '2025-12-31',
  })
  @IsString()
  @IsOptional()
  dueDateBefore?: string;

  @ApiPropertyOptional({
    enum: TodoStatusEnum,
    description: 'Filter todos by status.',
    example: TodoStatusEnum.NOT_STARTED,
  })
  @IsEnum(TodoStatusEnum)
  @IsOptional()
  status?: TodoStatusEnum;

  @ApiPropertyOptional({
    enum: TodoPriorityEnum,
    description: 'Filter todos by priority.',
    example: TodoPriorityEnum.MEDIUM,
  })
  @IsEnum(TodoPriorityEnum)
  @IsOptional()
  priority?: TodoPriorityEnum;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated tags to filter todos (e.g., "UI,backend").',
    example: 'UI',
  })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({
    description: 'Field to sort todos by.',
    enum: [
      ToDosSortByEnum.DUE_DATE,
      ToDosSortByEnum.STATUS,
      ToDosSortByEnum.NAME,
      ToDosSortByEnum.PRIORITY,
    ],
    example: ToDosSortByEnum.DUE_DATE,
    default: ToDosSortByEnum.DUE_DATE,
  })
  @IsEnum(ToDosSortByEnum)
  @IsOptional()
  sortBy?: ToDosSortByEnum = ToDosSortByEnum.DUE_DATE;

  @ApiPropertyOptional({
    description: 'Sort order ("ASC" for ascending, "DESC" for descending).',
    enum: [SortOrderEnum.ASC, SortOrderEnum.DESC],
    example: SortOrderEnum.DESC,
    default: SortOrderEnum.DESC,
  })
  @IsEnum(SortOrderEnum)
  @IsOptional()
  sortOrder?: SortOrderEnum.ASC | SortOrderEnum.DESC = SortOrderEnum.DESC;

  @ApiPropertyOptional({
    description:
      'Comma-separated list of fields to return.  Allowed options: uuid, name, description, dueDate, status, priority, tags',
    type: String,
    example: 'name',
  })
  @IsString()
  @IsOptional()
  fields?: string;
}

export class PaginatedTodosResponseDto {
  @ApiProperty({
    type: [GetTodoResponseDto],
    description: 'Array of todo items.',
  })
  data: GetTodoResponseDto[];

  @ApiProperty({ description: 'Total number of items available.', example: 50 })
  total: number;

  @ApiProperty({ description: 'Current page number.', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page.', example: 10 })
  limit: number;
}
