import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { LoginRequestDto } from './dtos/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findOneByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      return { id: user.id, uuid: user.uuid, email: user.email };
    }
    return null;
  }

  async login(
    loginRequestDto: LoginRequestDto,
  ): Promise<{ accessToken: string }> {
    const user = await this.validateUser(
      loginRequestDto.email,
      loginRequestDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { uuid: user.uuid, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
