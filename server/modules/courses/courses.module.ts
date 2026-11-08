import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';

// Запити до ШІ платні за квотою: не більше 30 на годину від однієї людини.
// Middleware працює раніше за перевірку входу, тому аноніма пропускає: його зупинить guard.
const aiLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  skip: (req) => !req.user,
  keyGenerator: (req) => `user-${req.user?.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато запитів до ШІ. Спробуйте за годину.' },
});

@Module({ controllers: [CoursesController], providers: [CoursesService] })
export class CoursesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(aiLimit).forRoutes({ path: 'courses/:id/roadmap/draft', method: RequestMethod.POST });
  }
}
