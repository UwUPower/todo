import { PartialType } from '@nestjs/swagger';
import { CreateTodoResponseDto } from './create-todo.dto';

export class GetTodoResponseDto extends PartialType(CreateTodoResponseDto) {}
