import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './user/entities/user.entity';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { TodoModule } from './todo/todo.module';
import { UserTodoModule } from './user-todo/user-todo.module';
import { Todo } from './todo/entities/todo.entity';
import { UserTodo } from './user-todo/entities/user-todo.entity';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 5432),
      username: process.env.DATABASE_USER || 'user',
      password: process.env.DATABASE_PASSWORD || 'password',
      database: process.env.DATABASE_NAME || 'todo',
      entities: [User, Todo, UserTodo],
      synchronize: true, // enable db automigration inferred from ORM. It should be disabled in a real production app
      logging: true, // enabling sql query log
    }),
    AuthModule,
    UserModule,
    UserTodoModule,
    TodoModule,
  ],
  controllers: [],
  providers: [],
})
export class ApiAppModule {}
