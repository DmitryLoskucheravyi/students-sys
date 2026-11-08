import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { NotificationsController, PublicQuizzesController, QuizzesController } from './quizzes.controller.js';
import { NotificationsService, PublicQuizzesService, QuizzesService } from './quizzes.service.js';

// Публічний тест може пройти будь-хто: обмежуємо перевірки з однієї адреси.
const publicLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато спроб. Зачекайте хвилину.' },
});

@Module({
  controllers: [QuizzesController, NotificationsController, PublicQuizzesController],
  providers: [QuizzesService, NotificationsService, PublicQuizzesService],
})
export class QuizzesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(publicLimit).forRoutes({ path: 'public/quizzes/:token/check', method: RequestMethod.POST });
  }
}
