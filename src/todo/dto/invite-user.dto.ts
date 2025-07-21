import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { UserTodoRole } from '../../user-todo/entities/user-todo.entity';

export class InviteUserRequestDto {
  @ApiProperty({
    description: 'The email of the user to assign/update role for.',
    example: 'foo.foo@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    enum: UserTodoRole,
    description: 'The role to assign to the user for this todo.',
    example: UserTodoRole.VIEWER,
  })
  @IsEnum(UserTodoRole)
  @IsNotEmpty()
  role: UserTodoRole;
}
