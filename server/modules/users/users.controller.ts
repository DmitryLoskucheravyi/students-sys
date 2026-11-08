import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/access.js';
import { UsersService } from './users.service.js';

@Controller('users')
@Roles('manager')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query('role') role: unknown) {
    return this.users.list(role);
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: any) {
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Param('id') idValue: string, @Body() body: any) {
    return this.users.update(idValue, body);
  }

  @Post(':id/password')
  @HttpCode(200)
  resetPassword(@Param('id') idValue: string, @Body() body: any) {
    return this.users.resetPassword(idValue, body?.password);
  }
}
