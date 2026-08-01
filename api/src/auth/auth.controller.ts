import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: Record<string, unknown>) {
    return this.auth.login(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: Record<string, unknown>) {
    return this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  resetPassword(@Body() body: Record<string, unknown>) {
    return this.auth.resetPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Headers('authorization') authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    return this.auth.logout(token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request & { user: { id: number } }) {
    return this.auth.me(req.user.id);
  }
}
