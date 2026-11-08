import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { q } from './db.js';
import { HttpError, str } from './lib.js';
import { parseAvatar } from './avatars.js';

const COOKIE = 'zoshyt_session';
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET === 'change-me') {
  throw new Error('Вкажіть JWT_SECRET у файлі .env');
}
const MAX_AGE = 7 * 24 * 3600 * 1000;

const sqlTime = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** Нова сесія входу: рядок у БД і cookie з її id. «Вийти» видаляє рядок. */
async function startSession(res, user) {
  const sid = randomUUID();
  // Прострочені сесії прибираємо під час входу: окремий планувальник не потрібен.
  await q('DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP()');
  await q('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?,?,?)', [sid, user.id, sqlTime(Date.now() + MAX_AGE)]);
  const token = jwt.sign({ sub: user.id, v: user.token_version, sid }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: MAX_AGE,
    path: '/',
  });
}

const publicUser = (u) => ({ id: u.id, role: u.role, name: u.name, login: u.login, phone: u.phone, avatar: u.avatar ?? null });

export async function authenticate(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      // Токен без сесії (виданий до її появи) або із завершеною сесією не діє.
      const [u] = payload.sid
        ? await q(
            `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
              WHERE s.id=? AND s.user_id=? AND s.expires_at > UTC_TIMESTAMP() AND u.is_active=1`,
            [payload.sid, payload.sub]
          )
        : [];
      if (u && u.token_version === payload.v) {
        req.user = u;
        req.sessionId = payload.sid;
      }
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
  await startSession(res, u);
  res.json(publicUser(u));
});

// Завершує сесію на сервері: навіть скопійований токен цього входу більше не діє.
authRouter.post('/logout', async (req, res) => {
  if (req.sessionId) await q('DELETE FROM auth_sessions WHERE id=?', [req.sessionId]);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json(req.user ? publicUser(req.user) : null);
});

/** Своя аватарка: лише з готового набору. */
authRouter.patch('/avatar', requireAuth, async (req, res) => {
  const avatar = parseAvatar(req.body?.avatar ?? null);
  await q('UPDATE users SET avatar=? WHERE id=?', [avatar, req.user.id]);
  res.json({ avatar });
});

authRouter.post('/password', requireAuth, async (req, res) => {
  const ok = await bcrypt.compare(String(req.body?.current ?? ''), req.user.password_hash);
  if (!ok) throw new HttpError(400, 'Поточний пароль неправильний');
  const hash = await hashPassword(validatePassword(req.body?.next));
  const version = req.user.token_version + 1;
  await q('UPDATE users SET password_hash=?, token_version=? WHERE id=?', [hash, version, req.user.id]);
  // Інші пристрої виходять, цей отримує нову сесію.
  await q('DELETE FROM auth_sessions WHERE user_id=?', [req.user.id]);
  await startSession(res, { ...req.user, token_version: version });
  res.json({ ok: true });
});
