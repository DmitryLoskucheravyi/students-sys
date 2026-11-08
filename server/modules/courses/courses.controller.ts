import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { Auth, CurrentUser, Roles } from '../../common/access.js';
import type { User } from '../../common/auth.js';
import { CoursesService } from './courses.service.js';

@Controller('courses')
@Auth()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.courses.list(user);
  }

  @Post()
  @HttpCode(201)
  @Roles('manager')
  create(@Body() body: any) {
    return this.courses.create(body);
  }

  @Get(':id')
  detail(@CurrentUser() user: User, @Param('id') idValue: string) {
    return this.courses.detail(user, idValue);
  }

  @Post(':id/students')
  @HttpCode(201)
  @Roles('manager')
  addStudent(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.addStudent(user, idValue, body);
  }

  @Patch(':id/students/:studentId')
  @Roles('manager')
  setStudentTeacher(@Param('id') idValue: string, @Param('studentId') studentId: string, @Body() body: any) {
    return this.courses.setStudentTeacher(idValue, studentId, body);
  }

  @Delete(':id/students/:studentId')
  @Roles('manager')
  removeStudent(@Param('id') idValue: string, @Param('studentId') studentId: string) {
    return this.courses.removeStudent(idValue, studentId);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.courses.update(idValue, body);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') idValue: string) {
    return this.courses.remove(idValue);
  }

  @Post(':id/steps')
  @HttpCode(201)
  addStep(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.addStep(user, idValue, body);
  }

  @Patch(':id/steps/:stepId')
  updateStep(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string, @Body() body: any) {
    return this.courses.updateStep(user, idValue, stepId, body);
  }

  @Delete(':id/steps/:stepId')
  removeStep(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string) {
    return this.courses.removeStep(user, idValue, stepId);
  }

  @Put(':id/steps-order')
  orderSteps(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.orderSteps(user, idValue, body);
  }

  // Ліміт запитів до ШІ навішено в CoursesModule.
  @Post(':id/roadmap/draft')
  @HttpCode(200)
  draft(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.draft(user, idValue, body);
  }

  @Post(':id/roadmap/import')
  @HttpCode(201)
  importSteps(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.importSteps(user, idValue, body);
  }

  @Put(':id/progress')
  setProgress(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.setProgress(user, idValue, body);
  }

  @Post(':id/steps/:stepId/substeps')
  @HttpCode(201)
  addSubstep(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string, @Body() body: any) {
    return this.courses.addSubstep(user, idValue, stepId, body);
  }

  @Patch(':id/substeps/:subId')
  renameSubstep(@CurrentUser() user: User, @Param('id') idValue: string, @Param('subId') subId: string, @Body() body: any) {
    return this.courses.renameSubstep(user, idValue, subId, body);
  }

  @Delete(':id/substeps/:subId')
  removeSubstep(@CurrentUser() user: User, @Param('id') idValue: string, @Param('subId') subId: string) {
    return this.courses.removeSubstep(user, idValue, subId);
  }

  @Put(':id/steps/:stepId/substeps-order')
  orderSubsteps(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string, @Body() body: any) {
    return this.courses.orderSubsteps(user, idValue, stepId, body);
  }

  @Put(':id/islands/:stepId')
  setIsland(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string, @Body() body: any) {
    return this.courses.setIsland(user, idValue, stepId, body);
  }

  @Delete(':id/islands/:stepId')
  removeIsland(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string) {
    return this.courses.removeIsland(user, idValue, stepId);
  }

  @Post(':id/islands/:stepId/start')
  @HttpCode(200)
  @Roles('student')
  startIsland(@CurrentUser() user: User, @Param('id') idValue: string, @Param('stepId') stepId: string) {
    return this.courses.startIsland(user, idValue, stepId);
  }

  @Put(':id/substep-progress')
  setSubstepProgress(@CurrentUser() user: User, @Param('id') idValue: string, @Body() body: any) {
    return this.courses.setSubstepProgress(user, idValue, body);
  }
}
