import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { UserTodo } from '../..//user-todo/entities/user-todo.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @OneToMany(() => UserTodo, (userTodo) => userTodo.user)
  userTodos: UserTodo[];
}
