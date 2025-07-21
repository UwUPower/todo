import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TodoDescriptionModule } from './todo-description/todo-description.module';
import { UserModule } from './user/user.module';
import { UserTodoModule } from './user-todo/user-todo.module';
import { User } from './user/entities/user.entity';
import { UserTodo } from './user-todo/entities/user-todo.entity';
import { Todo } from './todo/entities/todo.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [User, UserTodo, Todo],
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    TodoDescriptionModule,
    UserModule,
    UserTodoModule,
  ],
  controllers: [],
  providers: [],
})
export class WebSocketAppModule {}
