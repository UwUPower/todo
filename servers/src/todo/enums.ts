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

export enum ToDoQueryEnum {
  UUID = 'uuid',
  NAME = 'name',
  DESCRIPTION = 'description',
  DUE_DATE = 'dueDate',
  STATUS = 'status',
  PRIORITY = 'priority',
  TAGS = 'tags',
}

export enum ToDosSortByEnum {
  NAME = 'name',
  DUE_DATE = 'dueDate',
  STATUS = 'status',
  PRIORITY = 'priority',
}

export enum SortOrderEnum {
  ASC = 'ASC',
  DESC = 'DESC',
}
