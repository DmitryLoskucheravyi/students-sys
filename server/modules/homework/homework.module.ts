import { Module } from '@nestjs/common';
import { FilesController, HomeworkController } from './homework.controller.js';
import { FilesService, HomeworkService } from './homework.service.js';

@Module({ controllers: [HomeworkController, FilesController], providers: [HomeworkService, FilesService] })
export class HomeworkModule {}
