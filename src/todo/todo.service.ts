import {
  BadRequestException,
  ConflictException,
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
import { SortOrderEnum, ToDoQueryEnum, ToDosSortByEnum } from './enums';
import { GetTodosRequestDto } from './dto/get-todos.dto';
import {
  TODO_QUERY_ENUM_DB_FIELD_MAP,
  TODO_SORT_BY_ENUM_DB_FIELD_MAP,
} from './consts';

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

    const selectFields: (keyof Todo)[] = [];

    if (fields.length > 0) {
      const requestedEntityFields = fields
        .map((field) => TODO_QUERY_ENUM_DB_FIELD_MAP[field])
        .filter(Boolean);

      selectFields.push(...(requestedEntityFields as (keyof Todo)[]));
    } else {
      // If no specific fields are requested, select all fields necessary for TodoResponseDto
      // This makes sure all non-excluded fields in the DTO are available for transformation
      selectFields.push(
        'uuid',
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
  async findAll(
    userId: number,
    getTodosRequestDto: GetTodosRequestDto,
  ): Promise<{ data: Todo[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      name,
      uuid,
      dueDateBefore,
      dueDateAfter,
      status,
      priority,
      tags,
      sortBy = ToDosSortByEnum.DUE_DATE,
      sortOrder = SortOrderEnum.DESC,
      fields,
    } = getTodosRequestDto;

    const skip = (page - 1) * limit;

    const queryBuilder = this.todosRepository.createQueryBuilder('todo');

    queryBuilder
      .innerJoin(
        'users_todos',
        'userTodo',
        'userTodo.todoId = todo.id AND userTodo.userId = :userId AND userTodo.deletedAt IS NULL',
        { userId },
      )
      .where('todo.deletedAt IS NULL');

    // Filtering
    if (name) {
      queryBuilder.andWhere('LOWER(todo.name) LIKE LOWER(:name)', {
        name: `%${name}%`,
      });
    }

    if (uuid) {
      queryBuilder.andWhere('todo.uuid = :uuid', { uuid });
    }

    if (dueDateAfter || dueDateBefore) {
      const after = dueDateAfter ? new Date(dueDateAfter) : undefined;
      const before = dueDateBefore ? new Date(dueDateBefore) : undefined;

      if (after) after.setUTCHours(0, 0, 0, 0);
      if (before) before.setUTCHours(23, 59, 59, 999);

      if (after && before) {
        queryBuilder.andWhere('todo.dueDate BETWEEN :after AND :before', {
          after,
          before,
        });
      } else if (after) {
        queryBuilder.andWhere('todo.dueDate >= :after', { after });
      } else if (before) {
        queryBuilder.andWhere('todo.dueDate <= :before', { before });
      }
    }

    if (status) {
      queryBuilder.andWhere('todo.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('todo.priority = :priority', { priority });
    }

    if (tags) {
      const tagArray = tags.split(',').map((tag) => tag.trim());
      queryBuilder.andWhere(`(todo.attributes->'tags') ?| :tags`, {
        tags: tagArray,
      });
    }

    // Sorting

    const orderBy = TODO_SORT_BY_ENUM_DB_FIELD_MAP[sortBy] || 'todo.dueDate';
    queryBuilder.orderBy(orderBy, sortOrder);

    // Field Selection
    const defaultFields: (keyof Todo)[] = [
      'id',
      'uuid',
      'name',
      'description',
      'dueDate',
      'status',
      'priority',
      'attributes',
    ];

    let requestedFields: (keyof Todo)[] = [];

    if (fields) {
      const rawFields = fields.split(',').map((f) => f.trim());
      requestedFields = rawFields
        .filter((f) => f in TODO_QUERY_ENUM_DB_FIELD_MAP)
        .map((f) => TODO_QUERY_ENUM_DB_FIELD_MAP[f]);

      // If tags requested, include attributes
      if (
        rawFields.includes('tags') &&
        !requestedFields.includes('attributes')
      ) {
        requestedFields.push('attributes');
      }
    } else {
      requestedFields = [...defaultFields];
    }

    // Always include fields used in sorting, otherwise the ORDER BY clause will be failed
    const sortField = orderBy.split('.')[1] as keyof Todo;
    if (!requestedFields.includes(sortField)) {
      requestedFields.push(sortField);
    }

    const finalSelectFields = Array.from(new Set(['id', ...requestedFields]));
    queryBuilder.select(finalSelectFields.map((field) => `todo.${field}`));

    // Pagination + Result
    const [data, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return { data, total };
  }

  async softDelete(uuid: string, userId: number): Promise<void> {
    const todo = await this.todosRepository.findOne({
      where: { uuid, deletedAt: IsNull() },
    });
    if (!todo) {
      throw new NotFoundException(`Todo with UUID "${uuid}" not found.`);
    }

    const userTodo = await this.userTodoService.findOne(userId, todo.id);
    if (!userTodo || userTodo.role !== UserTodoRole.OWNER) {
      throw new ForbiddenException(
        'You do not have permission to update this todo.',
      );
    }

    await this.todosRepository.softDelete(todo.id);
  }

  async inviteUserToTodo(
    todoUuid: string,
    userId: number,
    invitedUserEmail: string,
    role: UserTodoRole,
  ): Promise<void> {
    const todo = await this.todosRepository.findOne({
      where: { uuid: todoUuid, deletedAt: IsNull() },
    });
    if (!todo) {
      throw new NotFoundException(`Todo with UUID "${todoUuid}" not found.`);
    }

    const userTodo = await this.userTodoService.findOne(userId, todo.id);
    if (!userTodo || userTodo.role !== UserTodoRole.OWNER) {
      throw new ForbiddenException(
        'You do not have permission to update this todo.',
      );
    }

    const invitedUser = await this.userService.findOneByEmail(invitedUserEmail);
    if (!invitedUser) {
      throw new NotFoundException(
        `User with email "${invitedUserEmail}" not found.`,
      );
    }

    const existingPermission = await this.userTodoService.findOne(
      invitedUser.id,
      todo.id,
    );
    if (existingPermission) {
      throw new ConflictException(
        `User "${invitedUserEmail}" is already assigned to this todo.`,
      );
    }

    await this.userTodoService.create(invitedUser.id, todo.id, role);
  }

  async updateUserRole(
    todoUuid: string,
    userId: number,
    targetUserEmail: string,
    newRole: UserTodoRole,
  ): Promise<void> {
    const todo = await this.todosRepository.findOne({
      where: { uuid: todoUuid, deletedAt: IsNull() },
    });
    if (!todo) {
      throw new NotFoundException(`Todo with UUID "${todoUuid}" not found.`);
    }

    const userTodo = await this.userTodoService.findOne(userId, todo.id);
    if (!userTodo || userTodo.role !== UserTodoRole.OWNER) {
      throw new ForbiddenException(
        'You do not have permission to update this todo.',
      );
    }

    const targetUser = await this.userService.findOneByEmail(targetUserEmail);
    if (!targetUser) {
      throw new NotFoundException(
        `Target user with email "${targetUserEmail}" not found.`,
      );
    }

    await this.userTodoService.updateRole(userId, todo.id, newRole);
  }
}
