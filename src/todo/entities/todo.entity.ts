import { Entity, Column, OneToMany } from 'typeorm';
import { UserTodo } from '../../user-todo/entities/user-todo.entity';
import { BaseEntity } from '../../common/entities/base.entity';

export enum TodoStatusEnum {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum TodoPriorityEnum {
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

  @Column({
    type: 'enum',
    enum: TodoStatusEnum,
    default: TodoStatusEnum.NOT_STARTED,
  })
  status: TodoStatusEnum;

  @Column({
    type: 'enum',
    enum: TodoPriorityEnum,
    default: TodoPriorityEnum.MEDIUM,
  })
  priority: TodoPriorityEnum;

  @Column({ type: 'jsonb', nullable: true })
  attributes: Tags; // Stores tags like {"tags": ["UI", "backend"]}

  @OneToMany(() => UserTodo, (usersTodo) => usersTodo.todo)
  usersTodo: UserTodo[];
}
