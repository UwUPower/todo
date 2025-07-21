import { ApiProperty } from '@nestjs/swagger';
import { UserTodoRole } from 'src/user-todo/entities/user-todo.entity';

export class GetUserTodoRoleResponseDto {
  @ApiProperty({ description: 'User role of that todo' })
  role: UserTodoRole;
}
