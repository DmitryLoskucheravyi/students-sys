import { Module } from '@nestjs/common';
import { NotificationsController, QuizzesController } from './quizzes.controller.js';
import { NotificationsService, QuizzesService } from './quizzes.service.js';

@Module({ controllers: [QuizzesController, NotificationsController], providers: [QuizzesService, NotificationsService] })
export class QuizzesModule {}
