import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { LessonsService, SchedulesService } from './lessons.service.js';

@Controller('lessons')
@Auth()
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get()
  @Roles('manager', 'teacher')
  list(@CurrentUser() user: User) {
    return this.lessons.list(user);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager')
  create(@Body() body: any) {
    return this.lessons.create(body);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.lessons.update(idValue, body);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @Roles('manager')
  archive(@Param('id') idValue: string) {
    return this.lessons.archive(idValue);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Roles('manager')
  restore(@Param('id') idValue: string) {
    return this.lessons.restore(idValue);
  }
}

@Controller('schedules')
@Auth()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @Roles('manager', 'teacher')
  list(@CurrentUser() user: User) {
    return this.schedules.list(user);
  }

  @Get(':id')
  @Roles('manager', 'teacher')
  get(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.schedules.get(user, idValue);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager')
  create(@Body() body: any) {
    return this.schedules.create(body);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.schedules.update(idValue, body);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') idValue: string) {
    return this.schedules.remove(idValue);
  }
}
