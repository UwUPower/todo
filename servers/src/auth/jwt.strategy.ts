import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity'; // For type hinting req.user

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'secret',
    });
  }

  async validate(payload: any): Promise<Partial<User>> {
    // Expect 'uuid' in the payload, not 'sub'
    // It is not safe to include the integer id in JWT
    const userUuidFromToken = payload.uuid;

    if (!userUuidFromToken) {
      throw new UnauthorizedException('User UUID not found in token.');
    }

    // Find the user by UUID to get their internal ID and other details
    const user = await this.userService.getUserByUuid(userUuidFromToken);

    if (!user) {
      throw new UnauthorizedException('User not found or invalid token.');
    }

    // Return the internal ID and UUID to be attached to req.user for services
    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
    };
  }
}
