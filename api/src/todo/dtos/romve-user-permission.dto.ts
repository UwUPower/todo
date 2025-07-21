import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { UserTodoRole } from '../../user-todo/entities/user-todo.entity';

export class RemoveUserPermissionRequestDto {
  @ApiProperty({
    description: 'The email of the user to be removed from a todo',
    example: 'foo.foo@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
