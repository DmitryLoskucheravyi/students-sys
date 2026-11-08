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
const dist = path.join(ROOT, 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  http.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
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
