import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { PlansService, SubscriptionsService } from './plans.service.js';

@Controller('plans')
@Roles('manager')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: any) {
    return this.plans.create(body);
  }

  @Patch(':id')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.plans.update(idValue, body);
  }
}

@Controller('subscriptions')
@Auth()
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('student_id') studentId: unknown) {
    return this.subs.list(user, studentId);
  }

  @Get(':id/charges')
  charges(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.subs.charges(user, idValue);
  }

  @Post(':id/writeoffs')
  @HttpCode(201)
  @Roles('manager')
  writeOff(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.subs.writeOff(user, idValue, body);
  }

  @Delete(':id/writeoffs/:writeoffId')
  @Roles('manager')
  undoWriteOff(@Param('id') idValue: string, @Param('writeoffId') writeoffId: string) {
    return this.subs.undoWriteOff(idValue, writeoffId);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager')
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.subs.create(user, body);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.subs.update(idValue, body);
  }
}
