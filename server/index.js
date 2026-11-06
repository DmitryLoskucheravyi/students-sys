import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpError } from './lib.js';
import { ensureDatabase } from './setup.js';

await ensureDatabase();

// Роути імпортуються після створення бази: вони одразу використовують пул.
const { q } = await import('./db.js');
const { authRouter, authenticate } = await import('./auth.js');
const { usersRouter } = await import('./routes/users.js');
const { plansRouter, subscriptionsRouter } = await import('./routes/plans.js');
const { coursesRouter } = await import('./routes/courses.js');
const { lessonsRouter, schedulesRouter } = await import('./routes/lessons.js');
const { sessionsRouter, requestsRouter } = await import('./routes/sessions.js');
const { homeworkRouter, filesRouter } = await import('./routes/homework.js');

const app = express();
app.disable('x-powered-by');
// Кількість проксі перед сервером: потрібна, щоб ліміт входів рахував реальний IP учня.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
// Для перевірок хостингу: не торкається бази, тож не будить її й не створює навантаження.
app.get('/healthz', (_req, res) => res.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT ?? null }));
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

const api = express.Router();
// Наскрізна перевірка після деплою: браузер, Vercel, Render, база.
api.get('/health', async (_req, res) => {
  await q('SELECT 1');
  res.json({ ok: true });
});
api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/plans', plansRouter);
api.use('/subscriptions', subscriptionsRouter);
api.use('/courses', coursesRouter);
api.use('/lessons', lessonsRouter);
api.use('/schedules', schedulesRouter);
api.use('/sessions', sessionsRouter);
api.use('/requests', requestsRouter);
api.use('/homework', homeworkRouter);
api.use('/files', filesRouter);
api.use((_req, _res, next) => next(Object.assign(new Error('Не знайдено'), { status: 404 })));
app.use('/api', api);

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  // Власні помилки написані для людини. Текст непередбачених не показуємо, бо там можуть бути деталі бази.
  const expected = err instanceof HttpError || status < 500;
  if (!expected) console.error(err);
  res.status(status).json({ error: expected ? err.message : 'Помилка сервера. Спробуйте ще раз.' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
// Express 5 передає помилку запуску (наприклад, зайнятий порт) у цей самий колбек.
app.listen(port, host, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Порт ${port} уже зайнятий. Зупиніть інший запущений сервер.` : err);
    process.exit(1);
  }
  console.log(`Be Smart School: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
