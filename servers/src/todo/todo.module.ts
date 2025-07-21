import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoService } from './todo.service';
import { TodoController } from './todo.controller';
import { Todo } from './entities/todo.entity';
import { UserTodoModule } from '../user-todo/user-todo.module';
import { UserModule } from '../user/user.module';
import { TodosController } from './todos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Todo]), UserTodoModule, UserModule],
  controllers: [TodoController, TodosController],
  providers: [TodoService],
  exports: [TodoService],
})
export class TodoModule {}
