import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Todo, TodoStatus, TodoPriority } from './entities/todo.entity';
import { UserTodoRole } from '../user-todo/entities/user-todo.entity';
import { UserTodoService } from '../user-todo/user-todo.service';
import { CreateTodoRequestDto } from './dto/create-todo.dto';
import { UpdateTodoRequestDto } from './dto/update-todo.dto';

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

  async update(
    uuid: string,
    updateRequestTodoDto: UpdateTodoRequestDto,
    userId: number,
  ): Promise<Todo> {
    const todo = await this.todosRepository.findOne({
      where: { uuid, deletedAt: IsNull() },
    });
    if (!todo) {
      throw new NotFoundException(`Todo with UUID "${uuid}" not found.`);
    }

    const userTodo = await this.userTodoService.findOne(userId, todo.id);
    if (
      !userTodo ||
      (userTodo.role !== UserTodoRole.OWNER &&
        userTodo.role !== UserTodoRole.EDITOR)
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this todo.',
      );
    }

    const todoToBeUpdated = {
      ...todo,
      name: updateRequestTodoDto.name ?? todo.name,
      description: updateRequestTodoDto.description ?? todo.description,
      dueDate: updateRequestTodoDto.dueDate ?? todo.dueDate,
      status: updateRequestTodoDto.status ?? todo.status,
      priority: updateRequestTodoDto.priority ?? todo.priority,
      attributes:
        updateRequestTodoDto.tags !== undefined
          ? { tags: updateRequestTodoDto.tags }
          : { tags: todo.attributes.tags },
    };

    return this.todosRepository.save(todoToBeUpdated);
  }
}
