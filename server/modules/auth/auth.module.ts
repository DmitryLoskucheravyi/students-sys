import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { clientKey } from '../../common/client-ip.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  // Рахуємо лише невдалі спроби: цілий клас за одним IP не має блокувати сам себе.
  skipSuccessfulRequests: true,
  // Справжня адреса відвідувача, а не проксі: інакше чужі помилки блокували б вхід усім
  keyGenerator: clientKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато спроб входу. Спробуйте за 15 хвилин.' },
});

// Через проксі Vercel IP відвідувача ненадійний, тому окремо рахуємо спроби на сам логін.
// Це захищає пароль, навіть якщо запити приходять із різних адрес.
const accountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login-${String(req.body?.login ?? '').trim().toLowerCase().slice(0, 40)}`,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: 'Забагато невдалих спроб для цього логіна. Спробуйте за 15 хвилин.' },
});

@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(loginLimit, accountLimit).forRoutes({ path: 'auth/login', method: RequestMethod.POST });
  }
}
