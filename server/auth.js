import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { q } from './db.js';
import { HttpError, str } from './lib.js';

const COOKIE = 'zoshyt_session';
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET === 'change-me') {
  throw new Error('Вкажіть JWT_SECRET у файлі .env');
}
const MAX_AGE = 7 * 24 * 3600 * 1000;

function setCookie(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: MAX_AGE,
    path: '/',
  });
}

const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name, login: u.login, phone: u.phone });

export async function authenticate(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      const [u] = await q('SELECT * FROM users WHERE id=? AND is_active=1', [payload.sub]);
      if (u && u.token_version === payload.v) req.user = u;
    } catch {
      /* недійсний токен — як анонім */
    }
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Увійдіть в акаунт');
  next();
}
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Увійдіть в акаунт');
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Немає доступу');
  next();
};

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw new HttpError(400, 'Пароль: мінімум 8 символів');
  if (p.length > 72) throw new HttpError(400, 'Пароль: максимум 72 символи');
  return p;
}
export const hashPassword = (p) => bcrypt.hash(p, 10);

export const authRouter = Router();

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  // Рахуємо лише невдалі спроби: цілий клас за одним IP не має блокувати сам себе.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато спроб входу. Спробуйте за 15 хвилин.' },
});

// Через проксі Vercel IP відвідувача ненадійний, тому окремо рахуємо спроби на сам логін.
// Це захищає пароль, навіть якщо запити приходять із різних адрес.
const accountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login-${String(req.body?.login ?? '').trim().toLowerCase().slice(0, 40)}`,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: 'Забагато невдалих спроб для цього логіна. Спробуйте за 15 хвилин.' },
});

// Хеш для порівняння, коли логіна не існує: час відповіді не видає, чи є такий користувач.
const dummyHash = bcrypt.hashSync('not-a-real-password', 10);

authRouter.post('/login', loginLimit, accountLimit, async (req, res) => {
  const login = str(req.body?.login, 'Логін', { max: 40 }).toLowerCase();
  const password = String(req.body?.password ?? '');
  const [u] = await q('SELECT * FROM users WHERE login=? AND is_active=1', [login]);
  const ok = await bcrypt.compare(password, u?.password_hash ?? dummyHash);
  if (!u || !ok) throw new HttpError(401, 'Неправильний логін або пароль');
  setCookie(res, u);
  res.json(publicUser(u));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json(req.user ? publicUser(req.user) : null);
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const ok = await bcrypt.compare(String(req.body?.current ?? ''), req.user.password_hash);
  if (!ok) throw new HttpError(400, 'Поточний пароль неправильний');
  const hash = await hashPassword(validatePassword(req.body?.next));
  const version = req.user.token_version + 1;
  await q('UPDATE users SET password_hash=?, token_version=? WHERE id=?', [hash, version, req.user.id]);
  setCookie(res, { ...req.user, token_version: version });
  res.json({ ok: true });
});
