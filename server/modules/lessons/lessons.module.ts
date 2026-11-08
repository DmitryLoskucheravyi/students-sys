import { Module } from '@nestjs/common';
import { LessonsController, SchedulesController } from './lessons.controller.js';
import { LessonsService, SchedulesService } from './lessons.service.js';

@Module({ controllers: [LessonsController, SchedulesController], providers: [LessonsService, SchedulesService] })
export class LessonsModule {}
