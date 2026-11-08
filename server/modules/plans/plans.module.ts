import { Module } from '@nestjs/common';
import { PlansController, SubscriptionsController } from './plans.controller.js';
import { PlansService, SubscriptionsService } from './plans.service.js';

@Module({ controllers: [PlansController, SubscriptionsController], providers: [PlansService, SubscriptionsService] })
export class PlansModule {}
