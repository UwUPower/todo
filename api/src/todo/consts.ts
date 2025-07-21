import { ToDoQueryEnum, ToDosSortByEnum } from './enums';

export const TODO_QUERY_ENUM_DB_FIELD_MAP = {
  [ToDoQueryEnum.UUID]: 'uuid',
  [ToDoQueryEnum.NAME]: 'name',
  [ToDoQueryEnum.DESCRIPTION]: 'description',
  [ToDoQueryEnum.DUE_DATE]: 'dueDate',
  [ToDoQueryEnum.STATUS]: 'status',
  [ToDoQueryEnum.PRIORITY]: 'priority',
  [ToDoQueryEnum.TAGS]: 'attributes', // Tags come from attributes
};

export const TODO_SORT_BY_ENUM_DB_FIELD_MAP = {
  [ToDosSortByEnum.NAME]: 'todo.name',
  [ToDosSortByEnum.DUE_DATE]: 'todo.dueDate',
  [ToDosSortByEnum.STATUS]: 'todo.status',
  [ToDosSortByEnum.PRIORITY]: 'todo.priority',
};
