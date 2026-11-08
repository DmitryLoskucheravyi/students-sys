import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { RequestsService, SessionsService } from './sessions.service.js';

@Controller('sessions')
@Auth()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: any) {
    return this.sessions.list(user, query);
  }

  // Раніше за ':id', щоб «summary» не сприйнявся як номер заняття.
  @Get('summary')
  @Roles('student')
  summary(@CurrentUser() user: User) {
    return this.sessions.summary(user);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.sessions.get(user, idValue);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  cancel(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.sessions.cancel(user, idValue, body);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  reschedule(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.sessions.reschedule(user, idValue, body);
  }

  @Patch(':id/location')
  @Roles('manager', 'teacher')
  setLocation(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.sessions.setLocation(user, idValue, body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  complete(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.sessions.complete(user, idValue, body);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  reopen(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.sessions.reopen(user, idValue);
  }

  @Post(':id/requests')
  @HttpCode(201)
  @Roles('student')
  request(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.sessions.request(user, idValue, body);
  }
}

@Controller('requests')
@Roles('manager', 'teacher')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.requests.list(user);
  }

  @Post(':id/:decision')
  @HttpCode(200)
  decide(@CurrentUser() user: User, @Param('id') idValue: string, @Param('decision') decision: string) {
    return this.requests.decide(user, idValue, decision);
  }
}
