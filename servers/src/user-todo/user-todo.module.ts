import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTodoService } from './user-todo.service';
import { UserTodo } from './entities/user-todo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserTodo])],
  providers: [UserTodoService],
  exports: [UserTodoService, TypeOrmModule.forFeature([UserTodo])],
})
export class UserTodoModule {}
