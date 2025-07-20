import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Todo } from '../../todo/entities/todo.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

export enum UserTodoRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

@Entity('users_todos')
@Unique(['userId', 'todoId'])
export class UserTodo extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'todo_id' })
  todoId: number;

  @Column({ type: 'enum', enum: UserTodoRole })
  role: UserTodoRole;

  @ManyToOne(() => User, (user) => user.userTodos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Todo, (todo) => todo.usersTodo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'todo_id' })
  todo: Todo;
}
