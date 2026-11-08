import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { q } from '../../db.js';
import { HttpError, str } from '../../lib.js';
import { parseAvatar } from '../../avatars.js';
import { type User, hashPassword, publicUser, startSession, validatePassword } from '../../common/auth.js';

// Хеш для порівняння, коли логіна не існує: час відповіді не видає, чи є такий користувач.
const dummyHash = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  async login(body: any, res: Response) {
    const login = str(body?.login, 'Логін', { max: 40 }).toLowerCase();
    const password = String(body?.password ?? '');
    const [u]: User[] = await q('SELECT * FROM users WHERE login=? AND is_active=1', [login]);
    const ok = await bcrypt.compare(password, u?.password_hash ?? dummyHash);
    if (!u || !ok) throw new HttpError(401, 'Неправильний логін або пароль');
    await startSession(res, u);
    return publicUser(u);
  }

  /** Завершує сесію на сервері: навіть скопійований токен цього входу більше не діє. */
  async logout(sessionId: string | undefined) {
    if (sessionId) await q('DELETE FROM auth_sessions WHERE id=?', [sessionId]);
  }

  /** Своя аватарка: лише з готового набору. */
  async setAvatar(user: User, value: unknown) {
    const avatar = parseAvatar(value ?? null);
    await q('UPDATE users SET avatar=? WHERE id=?', [avatar, user.id]);
    return { avatar };
  }

  async changePassword(user: User, body: any, res: Response) {
    const ok = await bcrypt.compare(String(body?.current ?? ''), user.password_hash);
    if (!ok) throw new HttpError(400, 'Поточний пароль неправильний');
    const hash = await hashPassword(validatePassword(body?.next));
    const version = user.token_version + 1;
    await q('UPDATE users SET password_hash=?, token_version=? WHERE id=?', [hash, version, user.id]);
    // Інші пристрої виходять, цей отримує нову сесію.
    await q('DELETE FROM auth_sessions WHERE user_id=?', [user.id]);
    await startSession(res, { ...user, token_version: version });
    return { ok: true };
  }
}
