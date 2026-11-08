import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './common/access.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HomeworkModule } from './modules/homework/homework.module.js';
import { LessonsModule } from './modules/lessons/lessons.module.js';
import { PlansModule } from './modules/plans/plans.module.js';
import { QuizzesModule } from './modules/quizzes/quizzes.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { UsersModule } from './modules/users/users.module.js';

/** Увесь API під /api. Доступ за ролями перевіряє один глобальний guard. */
@Module({
  imports: [
    HealthModule,
    AuthModule,
    UsersModule,
    PlansModule,
    CoursesModule,
    LessonsModule,
    SessionsModule,
    HomeworkModule,
    StatsModule,
    QuizzesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AccessGuard }],
})
export class AppModule {}
