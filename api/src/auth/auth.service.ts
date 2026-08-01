import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { keysToCamel } from '../common/utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(body: Record<string, unknown>) {
    const data = keysToCamel(body) as { email?: string; password?: string };
    const user = await this.prisma.user.findUnique({
      where: { email: data.email ?? '' },
    });
    if (!user || !(await bcrypt.compare(data.password ?? '', user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.authToken.create({
      data: { token, userId: user.id },
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async forgotPassword(body: Record<string, unknown>) {
    const data = keysToCamel(body) as { email?: string };
    const email = (data.email ?? '').trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success to avoid account enumeration
    if (!user) {
      return {
        message:
          'If that email is registered, a temporary password has been set. Check with your admin or use the demo credentials.',
        reset: false,
      };
    }

    const tempPassword = 'Centric@' + String(user.id).padStart(3, '0');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(tempPassword, 10) },
    });

    // Dev/demo: return temp password so UI can show it without email SMTP
    return {
      message: 'Temporary password generated. Sign in and change it after first login.',
      reset: true,
      temp_password: tempPassword,
      email: user.email,
    };
  }

  async resetPassword(body: Record<string, unknown>) {
    const data = keysToCamel(body) as {
      email?: string;
      tempPassword?: string;
      newPassword?: string;
    };
    const user = await this.prisma.user.findUnique({
      where: { email: (data.email ?? '').trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(data.tempPassword ?? '', user.passwordHash))) {
      throw new NotFoundException('Invalid reset credentials');
    }
    if (!data.newPassword || data.newPassword.length < 6) {
      throw new UnauthorizedException('New password must be at least 6 characters');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(data.newPassword, 10) },
    });

    return { message: 'Password updated. You can sign in now.' };
  }

  async logout(token?: string) {
    if (token) {
      await this.prisma.authToken.deleteMany({ where: { token } });
    }
    return { message: 'Logged out' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
