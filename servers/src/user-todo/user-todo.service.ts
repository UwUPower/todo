import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTodo, UserTodoRole } from './entities/user-todo.entity';

@Injectable()
export class UserTodoService {
  constructor(
    @InjectRepository(UserTodo)
    private userTodoRepository: Repository<UserTodo>,
  ) {}

  async createUserTodo(
    userId: number,
    todoId: number,
    role: UserTodoRole,
  ): Promise<UserTodo> {
    const newUserTodo = this.userTodoRepository.create({
      userId,
      todoId,
      role,
    });
    return this.userTodoRepository.save(newUserTodo);
  }

  async updateRole(
    userId: number,
    todoId: number,
    newRole: UserTodoRole,
  ): Promise<UserTodo> {
    const userTodo = await this.userTodoRepository.findOne({
      where: { userId, todoId },
    });
    if (!userTodo) {
      throw new NotFoundException(
        `UserTodo relation not found for userId ${userId} and todoId ${todoId}.`,
      );
    }

    userTodo.role = newRole;
    return this.userTodoRepository.save(userTodo);
  }

  async getTodoByUserIdAndTodoId(
    userId: number,
    todoId: number,
  ): Promise<UserTodo | null> {
    return this.userTodoRepository.findOne({ where: { userId, todoId } });
  }

  async removeUserPermission(userId: number, todoId: number): Promise<void> {
    const result = await this.userTodoRepository.softDelete({ userId, todoId });
    if (result.affected === 0) {
      throw new NotFoundException(`No permission has been deleted`);
    }
  }
}
