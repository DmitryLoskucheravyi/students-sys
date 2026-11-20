import 'reflect-metadata';
import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ensureDatabase } from './setup.js';
import { ROOT } from './paths.js';

await ensureDatabase();

// Модулі імпортуються після створення бази: вони одразу використовують пул.
const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('./app.module.js');
const { authenticate } = await import('./common/auth.js');
const { ErrorFilter } = await import('./common/errors.js');

const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn'] });
const http = app.getHttpAdapter().getInstance() as Express;
http.disable('x-powered-by');
// Кількість проксі перед сервером: потрібна, щоб ліміт входів рахував реальний IP учня.
if (process.env.TRUST_PROXY) http.set('trust proxy', Number(process.env.TRUST_PROXY));
// Для перевірок хостингу: не торкається бази, тож не будить її й не створює навантаження.
http.get('/healthz', (_req, res) => {
  res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT ?? null });
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        scriptSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: process.env.COOKIE_SECURE === 'true',
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(authenticate);
app.setGlobalPrefix('api');
app.useGlobalFilters(new ErrorFilter());

// Локально й у тестах сервер віддає ще й зібраний інтерфейс. У проді його роздає Vercel.
// Так само, як Vercel (vercel.json): зібрані сторінки сайту без «.html», кабінет і нові курси — оболонка застосунку,
// решта — 404.html зі статусом 404.
const dist = path.join(ROOT, 'client', 'dist');
if (existsSync(dist)) {
  const APP_SHELL = /^\/(cabinet|q|courses)(\/|$)|^\/(homework|lessons|people|stats|subscriptions|subscription|profile|tests|quizzes)(\/|$)/;
  app.use(express.static(dist, { redirect: false }));
  // Шлях — відносно root: з абсолютним шляхом send не віддає файл, якщо десь вище є тека з крапкою
  // (наприклад, репозиторій у .claude/worktrees/...), і замість сторінки виходить JSON 404.
  const send = (res: express.Response, file: string, status = 200) => res.status(status).sendFile(path.relative(dist, file), { root: dist });
  http.get(/^(?!\/api).*/, (req, res) => {
    let page = '';
    try { page = path.join(dist, `${decodeURIComponent(req.path).replace(/\/+$/, '') || '/index'}.html`); } catch { /* битий %-код */ }
    if (page.startsWith(dist + path.sep) && existsSync(page)) return send(res, page);
    if (APP_SHELL.test(req.path)) return send(res, path.join(dist, existsSync(path.join(dist, 'app.html')) ? 'app.html' : 'index.html'));
    const notFound = path.join(dist, '404.html');
    return existsSync(notFound) ? send(res, notFound, 404) : send(res, path.join(dist, 'index.html'));
  });
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
try {
  await app.listen(port, host);
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  console.error(code === 'EADDRINUSE' ? `Порт ${port} уже зайнятий. Зупиніть інший запущений сервер.` : err);
  process.exit(1);
}
console.log(`Be Smart School: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
