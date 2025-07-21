import { Entity, Column, OneToMany } from 'typeorm';
import { UserTodo } from '../../user-todo/entities/user-todo.entity';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TodoStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TodoPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface Tags {
  tags: string[];
}

@Entity('todos')
export class Todo extends BaseEntity {
  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  uuid: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'due_date',
    type: 'timestamp with time zone',
    nullable: true,
  })
  dueDate: Date;

  @Column({ type: 'enum', enum: TodoStatus, default: TodoStatus.NOT_STARTED })
  status: TodoStatus;

  @Column({ type: 'enum', enum: TodoPriority, default: TodoPriority.MEDIUM })
  priority: TodoPriority;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Tags; // Stores tags like {"tags": ["UI", "backend"]}

  @OneToMany(() => UserTodo, (usersTodo) => usersTodo.todo)
  usersTodo: UserTodo[];
}
