import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { NotificationsController, PublicQuizzesController, QuizzesController } from './quizzes.controller.js';
import { NotificationsService, QuizzesService } from './quizzes.service.js';
import { AssignmentsService } from './assignments.service.js';
import { QuizImagesService } from './quiz-images.service.js';
import { PublicQuizzesService } from './public-quizzes.service.js';
import { QuizRepository } from './quiz.repository.js';

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
  providers: [QuizRepository, QuizzesService, AssignmentsService, QuizImagesService, PublicQuizzesService, NotificationsService],
})
export class QuizzesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(publicLimit).forRoutes({ path: 'public/quizzes/:token/check', method: RequestMethod.POST });
  }
}
