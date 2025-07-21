import { Module } from '@nestjs/common';
import { TodoDescriptionGateway } from './todo-description.gateway';
import { UserModule } from '../user/user.module';
import { UserTodoModule } from '../user-todo/user-todo.module';
import { ConfigModule } from '@nestjs/config';
import { TodoDescriptionService } from './todo-description.service';
import { TodoModule } from '../todo/todo.module';

@Module({
  imports: [UserModule, UserTodoModule, ConfigModule, TodoModule],
  providers: [TodoDescriptionGateway, TodoDescriptionService],
})
export class TodoDescriptionModule {}
