import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Auth, CurrentUser } from '../../common/access.js';
import { COOKIE, type User, publicUser } from '../../common/auth.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body, res);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.sessionId);
    res.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  }

  // Nest не відправляє null як JSON, а клієнт чекає саме null для аноніма: відповідаємо напряму.
  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    res.json(req.user ? publicUser(req.user) : null);
  }

  @Patch('avatar')
  @Auth()
  avatar(@CurrentUser() user: User, @Body() body: any) {
    return this.auth.setAvatar(user, body?.avatar);
  }

  @Post('password')
  @HttpCode(200)
  @Auth()
  password(@CurrentUser() user: User, @Body() body: any, @Res({ passthrough: true }) res: Response) {
    return this.auth.changePassword(user, body, res);
  }
}
