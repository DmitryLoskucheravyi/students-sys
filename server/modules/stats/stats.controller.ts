import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/access.js';
import { StatsService } from './stats.service.js';

@Controller('stats')
@Roles('manager')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  summary(@Query() query: any) {
    return this.stats.summary(query);
  }
}
