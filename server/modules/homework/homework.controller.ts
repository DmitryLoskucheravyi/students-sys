import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { FilesService, HomeworkService } from './homework.service.js';

@Controller('homework')
@Auth()
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  // Раніше за ':id', щоб «topics» не сприйнявся як номер домашнього.
  @Get('topics')
  @Roles('manager', 'teacher')
  topics(@CurrentUser() user: User, @Query() query: any) {
    return this.homework.topics(user, query);
  }

  @Get()
  list(@CurrentUser() user: User) {
    return this.homework.list(user);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager', 'teacher')
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.homework.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.homework.get(user, idValue);
  }

  @Patch(':id')
  @Roles('manager', 'teacher')
  update(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.homework.update(user, idValue, body);
  }

  @Delete(':id')
  @Roles('manager', 'teacher')
  remove(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.homework.remove(user, idValue);
  }

  // Тіло — multipart: його читає multer усередині сервісу, тому потрібні сирі запит і відповідь.
  @Post(':id/submission')
  @HttpCode(201)
  @Roles('student')
  submit(@CurrentUser() user: User, @Param('id') idValue: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.homework.submit(user, idValue, req, res);
  }

  @Post('submissions/:id/review')
  @HttpCode(200)
  @Roles('manager', 'teacher')
  review(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.homework.review(user, idValue, body);
  }
}

@Controller('files')
@Auth()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Delete(':id')
  @Roles('student')
  remove(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.files.remove(user, idValue);
  }

  @Get(':id')
  send(@CurrentUser() user: User, @Param('id') idValue: string, @Query('download') download: unknown, @Res() res: Response) {
    return this.files.send(user, idValue, download !== undefined, res);
  }
}
