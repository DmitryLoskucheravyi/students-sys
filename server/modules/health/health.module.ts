import { Controller, Get, Module } from '@nestjs/common';
import { q } from '../../db.js';

/** Наскрізна перевірка після деплою: браузер, Vercel, Render, база. */
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    await q('SELECT 1');
    return { ok: true };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
