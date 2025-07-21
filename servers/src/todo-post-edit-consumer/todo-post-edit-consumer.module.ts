import { Module } from '@nestjs/common';
import { TodoPostEditConsumerService } from './todo-post-edit-consumer.service';
import { ConfigModule } from '@nestjs/config';
import { TodoModule } from '../todo/todo.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Todo } from '../todo/entities/todo.entity';

@Module({
  imports: [ConfigModule, TodoModule, TypeOrmModule.forFeature([Todo])],
  providers: [TodoPostEditConsumerService],
})
export class TodoPostEditConsumerModule {}
