import { IsString, IsEmail, MinLength } from 'class-validator';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'Name of the user',
    example: 'Foo Bar',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Email address of the user (must be unique)',
    example: 'foo.bar@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password for the user',
    example: 'foobarbar',
  })
  @IsString()
  password: string;
}

export class CreateUserResponseDto {
  @Exclude()
  id: number;

  @ApiProperty({ description: 'The UUID of the user.' })
  uuid: string;

  @ApiProperty({ description: 'The name of the user.' })
  name: string;

  @ApiProperty({ description: 'The email address of the user.' })
  email: string;

  @Exclude()
  password?: string;

  @Exclude()
  createdAt?: Date;

  @Exclude()
  updatedAt?: Date;

  @Exclude()
  deletedAt?: Date;
}
