import { PartialType } from '@nestjs/swagger';
import { CreateTodoRequestDto, CreateTodoResponseDto } from './create-todo.dto';

export class UpdateTodoRequestDto extends PartialType(CreateTodoRequestDto) {}

export class UpdateTodoResponseDto extends CreateTodoResponseDto {}
