import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { NotificationsService, QuizzesService } from './quizzes.service.js';
import { AssignmentsService } from './assignments.service.js';
import { QuizImagesService } from './quiz-images.service.js';
import { PublicQuizzesService } from './public-quizzes.service.js';

// Порядок методів важливий: конкретні шляхи (my, images, assignments) стоять раніше за ':id'.
@Controller('quizzes')
@Auth()
export class QuizzesController {
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly assignments: AssignmentsService,
    private readonly images: QuizImagesService
  ) {}

  @Get('my')
  @Roles('student')
  my(@CurrentUser() user: User) {
    return this.assignments.my(user);
  }

  @Post('images')
  @HttpCode(201)
  @Roles('manager', 'teacher')
  uploadImage(@CurrentUser() user: User, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.images.upload(user, req, res);
  }

  @Get('images/:name')
  sendImage(@CurrentUser() user: User, @Param('name') name: string, @Res() res: Response) {
    return this.images.send(user, name, res);
  }

  @Patch('assignments/:aid')
  @Roles('manager')
  updateAssignment(@Param('aid') aid: string, @Body() body: any) {
    return this.assignments.update(aid, body);
  }

  @Delete('assignments/:aid')
  @Roles('manager')
  removeAssignment(@Param('aid') aid: string) {
    return this.assignments.remove(aid);
  }

  @Post('assignments/:aid/reset')
  @HttpCode(200)
  @Roles('manager')
  resetAssignment(@Param('aid') aid: string) {
    return this.assignments.reset(aid);
  }

  @Get('assignments/:aid')
  getAssignment(@CurrentUser() user: User, @Param('aid') aid: string) {
    return this.assignments.get(user, aid);
  }

  @Post('assignments/:aid/submit')
  @HttpCode(200)
  @Roles('student')
  submit(@CurrentUser() user: User, @Param('aid') aid: string, @Body() body: any) {
    return this.assignments.submit(user, aid, body);
  }

  @Get()
  @Roles('manager', 'teacher')
  list(@CurrentUser() user: User) {
    return this.quizzes.list(user);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager', 'teacher')
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.quizzes.create(user, body);
  }

  @Get(':id')
  @Roles('manager', 'teacher')
  get(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.quizzes.get(user, idValue);
  }

  @Put(':id')
  @Roles('manager', 'teacher')
  update(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.quizzes.update(user, idValue, body);
  }

  @Delete(':id')
  @Roles('manager', 'teacher')
  remove(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.quizzes.remove(user, idValue);
  }

  @Post(':id/share')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  share(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.quizzes.share(user, idValue, true);
  }

  @Delete(':id/share')
  @Roles('manager', 'teacher')
  unshare(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.quizzes.share(user, idValue, false);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles('manager')
  approve(@Param('id') idValue: string) {
    return this.quizzes.approve(idValue);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('manager')
  reject(@Param('id') idValue: string, @Body() body: any) {
    return this.quizzes.reject(idValue, body);
  }

  @Post(':id/assignments')
  @HttpCode(201)
  @Roles('manager')
  assign(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.assignments.assign(user, idValue, body);
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

/** Тест за публічним посиланням: без входу. */
@Controller('public/quizzes')
export class PublicQuizzesController {
  constructor(
    private readonly quizzes: PublicQuizzesService,
    private readonly images: QuizImagesService
  ) {}

  @Get(':token')
  get(@Req() req: Request, @Param('token') token: string) {
    return this.quizzes.get(req.user ?? null, token);
  }

  @Post(':token/check')
  @HttpCode(200)
  check(@Req() req: Request, @Param('token') token: string, @Body() body: any) {
    return this.quizzes.check(req.user ?? null, token, body);
  }

  @Get(':token/images/:name')
  image(@Param('token') token: string, @Param('name') name: string, @Res() res: Response) {
    return this.images.sendShared(token, name, res);
  }
}
