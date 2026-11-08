import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';
import { HttpError } from '../lib.js';

export type Role = 'manager' | 'teacher' | 'student';

/** Користувач із бази, як його бачить сервер. Пароль ніколи не йде в відповідь: див. publicUser. */
export interface User {
  id: number;
  role: Role;
  name: string;
  login: string;
  phone: string | null;
  avatar: string | null;
  password_hash: string;
  token_version: number;
  is_active: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User | null;
      sessionId?: string;
    }
  }
}

export const COOKIE = 'zoshyt_session';
const SECRET = process.env.JWT_SECRET ?? '';
if (!SECRET || SECRET === 'change-me') {
  throw new Error('Вкажіть JWT_SECRET у файлі .env');
}
export const MAX_AGE = 7 * 24 * 3600 * 1000;

const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** Нова сесія входу: рядок у БД і cookie з її id. «Вийти» видаляє рядок. */
export async function startSession(res: Response, user: Pick<User, 'id' | 'token_version'>): Promise<void> {
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

export const publicUser = (u: User) => ({ id: u.id, role: u.role, name: u.name, login: u.login, phone: u.phone, avatar: u.avatar ?? null });

interface TokenPayload { sub: number; v: number; sid?: string }

/** Глобальний middleware: розпізнає користувача за cookie. Без входу req.user лишається null. */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.user = null;
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET) as unknown as TokenPayload;
      // Токен без сесії (виданий до її появи) або із завершеною сесією не діє.
      const [u]: User[] = payload.sid
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

export function validatePassword(p: unknown): string {
  if (typeof p !== 'string' || p.length < 8) throw new HttpError(400, 'Пароль: мінімум 8 символів');
  if (p.length > 72) throw new HttpError(400, 'Пароль: максимум 72 символи');
  return p;
}
export const hashPassword = (p: string) => bcrypt.hash(p, 10);
