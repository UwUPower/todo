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
import { UserService } from 'src/user/user.service';
import { ToDoQueryEnum } from './enum/todo-query-enum';
import { GetTodosRequestDto } from './dto/get-todos.dto';

@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(Todo)
    private todosRepository: Repository<Todo>,
    private readonly userService: UserService,
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

    const createdTodo = await this.todosRepository.save(newTodo);

    await this.userTodoService.create(
      userId,
      createdTodo.id,
      UserTodoRole.OWNER,
    );

    return createdTodo;
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

    const updatedTodo = await this.todosRepository.save(todoToBeUpdated);
    return updatedTodo;
  }
  async findOneByUuid(
    uuid: string,
    userId: number,
    fields: string[] = [],
  ): Promise<Partial<Todo>> {
    const todoIdObject = await this.todosRepository.findOne({
      where: { uuid },
      select: ['id'],
    });

    if (!todoIdObject) {
      throw new NotFoundException(`Todo with UUID "${uuid}" not found.`);
    }

    const todoId = todoIdObject.id;

    const userTodo = await this.userTodoService.findOne(userId, todoId);

    if (!userTodo) {
      throw new ForbiddenException(
        'You do not have permission to access this todo.',
      );
    }

    const selectFields: (keyof Todo)[] = ['id', 'uuid'];

    if (fields.length > 0) {
      const entityFieldsMap = {
        [ToDoQueryEnum.UUID]: 'uuid',
        [ToDoQueryEnum.NAME]: 'name',
        [ToDoQueryEnum.DESCRIPTION]: 'description',
        [ToDoQueryEnum.DUE_DATE]: 'dueDate',
        [ToDoQueryEnum.STATUS]: 'status',
        [ToDoQueryEnum.PRIORITY]: 'priority',
        [ToDoQueryEnum.TAGS]: 'attributes', // Tags come from attributes
      };

      const requestedEntityFields = fields
        .map((field) => entityFieldsMap[field])
        .filter(Boolean);

      // Add 'attributes' if 'tags' was requested, as tags are derived from it.
      if (
        fields.includes(ToDoQueryEnum.TAGS) &&
        !requestedEntityFields.includes('attributes')
      ) {
        requestedEntityFields.push('attributes');
      }

      selectFields.push(...(requestedEntityFields as (keyof Todo)[]));
    } else {
      // If no specific fields are requested, select all fields necessary for TodoResponseDto
      // This makes sure all non-excluded fields in the DTO are available for transformation
      selectFields.push(
        'name',
        'description',
        'dueDate',
        'status',
        'priority',
        'attributes',
      );
    }

    // Remove duplicates
    const finalSelectFields = Array.from(new Set(selectFields));

    const todo = await this.todosRepository.findOne({
      where: { uuid },
      select: finalSelectFields,
    });

    if (!todo) {
      throw new NotFoundException(`Todo with UUID "${uuid}" not found.`);
    }

    return todo;
  }
}
