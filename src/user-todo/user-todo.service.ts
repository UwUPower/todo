import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTodo, UserTodoRole } from './entities/user-todo.entity';

@Injectable()
export class UserTodoService {
  constructor(
    @InjectRepository(UserTodo)
    private userTodoRepository: Repository<UserTodo>,
  ) {}

  async create(
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

  async findOne(userId: number, todoId: number): Promise<UserTodo | null> {
    return this.userTodoRepository.findOne({ where: { userId, todoId } });
  }
}
