import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'centric-dev-secret',
    });
  }

  async validate(payload: { sub: number; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
