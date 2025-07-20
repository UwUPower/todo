import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';
import { TodoStatus, TodoPriority, Tags } from '../entities/todo.entity';
import { Exclude, Expose, Transform } from 'class-transformer';

export class CreateTodoRequestDto {
  @ApiProperty({
    description: 'Name of the todo item',
    example: 'Buy groceries',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the todo item',
    example: 'Milk, eggs, bread, and fruits',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Due date for the todo item (ISO 8601 format)',
    example: '2025-07-30T10:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @ApiProperty({
    enum: TodoStatus,
    description: 'Status of the todo item',
    example: TodoStatus.NOT_STARTED,
    default: TodoStatus.NOT_STARTED,
  })
  @IsEnum(TodoStatus)
  @IsOptional()
  status?: TodoStatus = TodoStatus.NOT_STARTED;

  @ApiProperty({
    enum: TodoPriority,
    description: 'Priority of the todo item',
    example: TodoPriority.MEDIUM,
    default: TodoPriority.MEDIUM,
  })
  @IsEnum(TodoPriority)
  @IsOptional()
  priority?: TodoPriority = TodoPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'Tags for a todo item',
    type: 'array',
    example: ['UI', 'backend'],
  })
  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class CreateTodoResponseDto {
  @ApiProperty({
    description: 'The UUID of the todo item.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  uuid: string;

  @ApiProperty({
    description: 'The name of the todo item.',
    example: 'Schedule meeting',
  })
  name: string;

  @ApiProperty({
    description: 'The description of the todo item.',
    example: 'Discuss Q3 results',
  })
  description: string;

  @ApiProperty({
    description: 'The due date of the todo item.',
    example: '2025-12-31T23:59:59Z',
  })
  dueDate: Date;

  @ApiProperty({
    enum: TodoStatus,
    description: 'The status of the todo item.',
    example: TodoStatus.IN_PROGRESS,
  })
  status: TodoStatus;

  @ApiProperty({
    enum: TodoPriority,
    description: 'The priority of the todo item.',
    example: TodoPriority.HIGH,
  })
  priority: TodoPriority;

  @ApiProperty({
    type: [String],
    description:
      'Tags associated with the todo item (derived from attributes).',
    example: ['work', 'important'],
  })
  @Expose({ name: 'tags' })
  @Transform(({ value }) => {
    if (value && value.tags) {
      return value.tags;
    } else {
      return [];
    }
  })
  attributes?: Record<string, any>;

  @Exclude()
  id?: number;

  @Exclude()
  createdAt?: Date;

  @Exclude()
  updatedAt?: Date;

  @Exclude()
  deletedAt?: Date;
}
