import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({
    description: 'Email address of the user',
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

export class LoginResponseDto {
  @ApiProperty({ description: 'The JWT access token for authentication.' })
  access_token: string;
}
