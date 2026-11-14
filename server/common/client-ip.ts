/*
 * Адреса відвідувача для лімітів запитів.
 * Запити йдуть через проксі Vercel, тож req.ip — адреса проксі, однакова для всіх: ліміт за нею
 * блокував би одразу всю школу. Vercel кладе справжню адресу першою в X-Forwarded-For.
 */
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

/** Перша адреса з X-Forwarded-For (рядок або масив заголовків), інакше req.ip. Чиста функція. */
export function clientIp(forwarded: string | string[] | undefined, fallback: string | undefined): string {
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw ?? '').split(',')[0].trim() || fallback || '';
}

/** Ключ для express-rate-limit: IPv6 зводиться до підмережі, щоб не обходили лімит зміною адреси. */
export const clientKey = (req: Request): string => ipKeyGenerator(clientIp(req.headers['x-forwarded-for'], req.ip));
