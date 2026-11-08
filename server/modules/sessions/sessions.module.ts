import { Module } from '@nestjs/common';
import { RequestsController, SessionsController } from './sessions.controller.js';
import { RequestsService, SessionsService } from './sessions.service.js';

@Module({ controllers: [SessionsController, RequestsController], providers: [SessionsService, RequestsService] })
export class SessionsModule {}
