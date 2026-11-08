import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { NotificationsService, QuizzesService } from './quizzes.service.js';

// Порядок методів важливий: конкретні шляхи (my, images, assignments) стоять раніше за ':id'.
@Controller('quizzes')
@Auth()
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get('my')
  @Roles('student')
  my(@CurrentUser() user: User) {
    return this.quizzes.my(user);
  }

  @Post('images')
  @HttpCode(201)
  @Roles('manager')
  uploadImage(@CurrentUser() user: User, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.quizzes.uploadImage(user, req, res);
  }

  @Get('images/:name')
  sendImage(@CurrentUser() user: User, @Param('name') name: string, @Res() res: Response) {
    return this.quizzes.sendImage(user, name, res);
  }

  @Patch('assignments/:aid')
  @Roles('manager')
  updateAssignment(@Param('aid') aid: string, @Body() body: any) {
    return this.quizzes.updateAssignment(aid, body);
  }

  @Delete('assignments/:aid')
  @Roles('manager')
  removeAssignment(@Param('aid') aid: string) {
    return this.quizzes.removeAssignment(aid);
  }

  @Post('assignments/:aid/reset')
  @HttpCode(200)
  @Roles('manager')
  resetAssignment(@Param('aid') aid: string) {
    return this.quizzes.resetAssignment(aid);
  }

  @Get('assignments/:aid')
  getAssignment(@CurrentUser() user: User, @Param('aid') aid: string) {
    return this.quizzes.getAssignment(user, aid);
  }

  @Post('assignments/:aid/submit')
  @HttpCode(200)
  @Roles('student')
  submit(@CurrentUser() user: User, @Param('aid') aid: string, @Body() body: any) {
    return this.quizzes.submit(user, aid, body);
  }

  @Get()
  @Roles('manager')
  list() {
    return this.quizzes.list();
  }

  @Post()
  @HttpCode(201)
  @Roles('manager')
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.quizzes.create(user, body);
  }

  @Get(':id')
  @Roles('manager')
  get(@Param('id') idValue: string) {
    return this.quizzes.get(idValue);
  }

  @Put(':id')
  @Roles('manager')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.quizzes.update(idValue, body);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') idValue: string) {
    return this.quizzes.remove(idValue);
  }

  @Post(':id/assignments')
  @HttpCode(201)
  @Roles('manager')
  assign(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.quizzes.assign(user, idValue, body);
  }
}

@Controller('notifications')
@Auth()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  count(@CurrentUser() user: User) {
    return this.notifications.count(user);
  }
}
