import { Body, Controller, Delete, Get, HttpCode, type MiddlewareConsumer, Module, type NestModule, Param, Patch, Post, Put, Req, RequestMethod, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Roles } from '../../common/access.js';
import { SiteAdminService, SiteService } from './site.service.js';

/** Сайт школи для відвідувачів: без входу. */
@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  @Get()
  overview() {
    return this.site.overview();
  }

  /** Сторінка «курсу» на сайті — це напрямок. */
  @Get('courses/:id')
  direction(@Param('id') idValue: string) {
    return this.site.direction(idValue);
  }

  @Get('images/:name')
  image(@Param('name') name: string, @Res() res: Response) {
    return this.site.image(name, res);
  }

  @Post('leads')
  @HttpCode(201)
  lead(@Body() body: any) {
    return this.site.lead(body);
  }
}

/** Керування сайтом у кабінеті менеджера. */
@Controller('site-admin')
@Roles('manager')
export class SiteAdminController {
  constructor(private readonly admin: SiteAdminService) {}

  @Get('leads')
  leads() {
    return this.admin.leads();
  }

  @Get('leads/new')
  newLeads() {
    return this.admin.newLeads();
  }

  @Patch('leads/:id')
  setLead(@Param('id') idValue: string, @Body() body: any) {
    return this.admin.setLead(idValue, body);
  }

  @Delete('leads/:id')
  removeLead(@Param('id') idValue: string) {
    return this.admin.removeLead(idValue);
  }

  @Get('reviews')
  reviews() {
    return this.admin.reviews();
  }

  @Post('reviews')
  @HttpCode(201)
  createReview(@Body() body: any) {
    return this.admin.createReview(body);
  }

  @Patch('reviews/:id')
  updateReview(@Param('id') idValue: string, @Body() body: any) {
    return this.admin.updateReview(idValue, body);
  }

  @Delete('reviews/:id')
  removeReview(@Param('id') idValue: string) {
    return this.admin.removeReview(idValue);
  }

  @Get('projects')
  projects() {
    return this.admin.projects();
  }

  @Post('projects')
  @HttpCode(201)
  createProject(@Body() body: any) {
    return this.admin.createProject(body);
  }

  @Patch('projects/:id')
  updateProject(@Param('id') idValue: string, @Body() body: any) {
    return this.admin.updateProject(idValue, body);
  }

  @Delete('projects/:id')
  removeProject(@Param('id') idValue: string) {
    return this.admin.removeProject(idValue);
  }

  @Post('images')
  @HttpCode(201)
  uploadImage(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.admin.uploadImage(req, res);
  }

  @Get('images/:name')
  sendImage(@Param('name') name: string, @Res() res: Response) {
    return this.admin.sendImage(name, res);
  }

  @Get('directions')
  directions() {
    return this.admin.directions();
  }

  @Post('directions')
  @HttpCode(201)
  createDirection(@Body() body: any) {
    return this.admin.createDirection(body);
  }

  @Put('directions/order')
  orderDirections(@Body() body: any) {
    return this.admin.orderDirections(body);
  }

  @Patch('directions/:id')
  updateDirection(@Param('id') idValue: string, @Body() body: any) {
    return this.admin.updateDirection(idValue, body);
  }

  @Delete('directions/:id')
  removeDirection(@Param('id') idValue: string) {
    return this.admin.removeDirection(idValue);
  }

  @Get('showcase')
  showcase() {
    return this.admin.showcase();
  }

  @Put('showcase')
  setShowcase(@Body() body: any) {
    return this.admin.setShowcase(body);
  }

  @Get('settings')
  settings() {
    return this.admin.settings();
  }

  @Put('settings')
  setSettings(@Body() body: any) {
    return this.admin.setSettings(body);
  }
}

// Заявки з сайту: не більше 6 за 10 хвилин з однієї адреси, щоб бот не засипав адміна.
// Запити йдуть через проксі Vercel, тож адреса відвідувача — перша в X-Forwarded-For: інакше всі відвідувачі
// злилися б в одну адресу й блокували одне одного. Невдалі спроби (помилка в номері) не рахуються.
const leadLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 6,
  skipFailedRequests: true,
  keyGenerator: (req) => ipKeyGenerator(String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.ip || ''),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато заявок. Спробуйте трохи згодом або зателефонуйте нам.' },
});

@Module({
  controllers: [SiteController, SiteAdminController],
  providers: [SiteService, SiteAdminService],
})
export class SiteModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(leadLimit).forRoutes({ path: 'site/leads', method: RequestMethod.POST });
  }
}
