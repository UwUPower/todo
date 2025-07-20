import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo, TodoStatus, TodoPriority } from './entities/todo.entity';
import { UserTodoRole } from '../user-todo/entities/user-todo.entity';
import { UserTodoService } from '../user-todo/user-todo.service';
import { CreateTodoRequestDto } from './dto/create-todo.dto';

@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(Todo)
    private todosRepository: Repository<Todo>,
    private readonly userTodoService: UserTodoService,
  ) {}

  async create(
    createTodoRequestDto: CreateTodoRequestDto,
    userId: number,
  ): Promise<Todo> {
    const newTodo = this.todosRepository.create({
      name: createTodoRequestDto.name,
      description: createTodoRequestDto.description,
      dueDate: createTodoRequestDto.dueDate,
      status: createTodoRequestDto.status || TodoStatus.NOT_STARTED,
      priority: createTodoRequestDto.priority || TodoPriority.MEDIUM,
      attributes: createTodoRequestDto.tags
        ? { tags: createTodoRequestDto.tags }
        : { tags: [] },
    });

    const savedTodo = await this.todosRepository.save(newTodo);

    await this.userTodoService.create(userId, savedTodo.id, UserTodoRole.OWNER);

    return savedTodo;
  }
}
