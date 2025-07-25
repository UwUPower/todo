import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { UserTodoModule } from '../user-todo/user-todo.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, UserTodoModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
