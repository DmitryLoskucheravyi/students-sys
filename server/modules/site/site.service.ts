import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type { Request, Response } from 'express';
import multer from 'multer';
import { type Row, q } from '../../db.js';
import { bad, id, idList, normalizePhone, notFound, str } from '../../lib.js';
import { UPLOAD_DIR, persistFile, removeFile } from '../../storage.js';
import { imageMime, readHead, sendStored } from '../../files.js';

/* Скріни проєктів: до 5 МБ (браузер і так зменшує до 1600 px), лише PNG, JPG, WEBP, GIF. */
const MAX_IMAGE_MB = 5;
const IMAGE_NAME = /^[0-9a-f-]{36}\.bin$/;
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, _file, cb) => cb(null, `${randomUUID()}.bin`) }),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1, fields: 0 },
}).single('image');

const PROJECT_SELECT = `SELECT p.id, p.title, p.author, p.description, p.course_id, p.url, p.image, p.is_published, p.created_at,
  c.title AS course_title, c.theme AS course_theme
  FROM projects p LEFT JOIN courses c ON c.id = p.course_id`;

/** Посилання на проєкт: лише http(s), щоб на сайт не потрапив javascript: чи щось подібне. */
function projectUrl(v: unknown): string | null {
  const s = str(v, 'Посилання', { max: 300, required: false });
  if (!s) return null;
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`); } catch { throw bad('Перевірте посилання'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw bad('Перевірте посилання');
  return u.href;
}

async function parseProject(b: any) {
  const image = b.image ? String(b.image) : null;
  if (image && (!IMAGE_NAME.test(image) || !(await q('SELECT 1 FROM site_images WHERE stored_name = ?', [image])).length)) throw bad('Картинку не знайдено');
  return {
    title: str(b.title, 'Назва', { max: 120 }),
    author: str(b.author, 'Автор', { max: 80, required: false }),
    description: str(b.description, 'Опис', { max: 600, required: false }),
    course_id: b.course_id ? id(b.course_id, 'Курс') : null,
    url: projectUrl(b.url),
    image,
    is_published: b.is_published === false || b.is_published === 0 ? 0 : 1,
  };
}

/** Картинка більше ніде не потрібна — прибрати і з бази, і зі сховища. */
async function dropImage(name: string | null) {
  if (!name) return;
  const [{ n }] = await q('SELECT COUNT(*) AS n FROM projects WHERE image = ?', [name]);
  if (Number(n) > 0) return;
  await q('DELETE FROM site_images WHERE stored_name = ?', [name]);
  await removeFile(name);
}

/** Контакти школи, які менеджер задає в кабінеті. Решта ключів ігнорується. */
export const SETTINGS = ['phone', 'telegram', 'instagram', 'tiktok', 'facebook', 'email', 'address'] as const;
type Setting = (typeof SETTINGS)[number];
const SETTING_MAX: Record<Setting, number> = { phone: 32, telegram: 120, instagram: 120, tiktok: 120, facebook: 160, email: 120, address: 300 };
const SOCIAL_NAME: Partial<Record<Setting, string>> = { telegram: 'Telegram', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Заявка в Telegram адміну. Токен і чат — лише в змінних середовища (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
 * Без них або при збої заявка все одно лишається в базі й видна в кабінеті.
 */
async function sendToTelegram(lead: { name: string; phone: string; note: string | null }): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const text = [
    '<b>Нова заявка з сайту</b>',
    `👤 ${escapeHtml(lead.name)}`,
    `📞 <a href="tel:${lead.phone}">${lead.phone}</a>`,
    lead.note ? `💬 ${escapeHtml(lead.note)}` : null,
  ].filter(Boolean).join('\n');
  try {
    // TELEGRAM_API_BASE — лише для тестів (підставний Telegram), у проді завжди справжній.
    const base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function settings(): Promise<Record<Setting, string>> {
  const rows: Row[] = await q('SELECT name, value FROM site_settings');
  const out = Object.fromEntries(SETTINGS.map((k) => [k, ''])) as Record<Setting, string>;
  for (const r of rows) if ((SETTINGS as readonly string[]).includes(r.name)) out[r.name as Setting] = r.value;
  return out;
}

const REVIEW_SELECT = `SELECT r.id, r.author, r.author_role, r.text, r.course_id, r.is_published, r.created_at, c.title AS course_title
  FROM reviews r LEFT JOIN courses c ON c.id = r.course_id`;

function parseReview(b: any) {
  return {
    author: str(b.author, "Ім'я", { max: 80 }),
    author_role: str(b.author_role, 'Хто це', { max: 60, required: false }),
    text: str(b.text, 'Відгук', { max: 1200 }),
    course_id: b.course_id ? id(b.course_id, 'Курс') : null,
    is_published: b.is_published === false || b.is_published === 0 ? 0 : 1,
  };
}

/** Публічна частина: те, що бачить відвідувач сайту. Нічого особистого: ні учнів, ні вчителів. */
@Injectable()
export class SiteService {
  async overview() {
    const [courses, plans, reviews, contacts, projects] = await Promise.all([
      q(`SELECT c.id, c.title, c.summary, c.icon, c.theme,
                (SELECT COUNT(*) FROM roadmap_steps s WHERE s.course_id = c.id) AS steps
           FROM courses c WHERE c.on_site = 1 ORDER BY c.title`),
      q(`SELECT id, name, lessons_count, price_per_lesson, valid_days, color
           FROM plans WHERE on_site = 1 AND is_active = 1 ORDER BY lessons_count`),
      q(`${REVIEW_SELECT} WHERE r.is_published = 1 ORDER BY r.id DESC`),
      settings(),
      q(`${PROJECT_SELECT} WHERE p.is_published = 1 ORDER BY p.id DESC`),
    ]);
    return {
      projects: projects.map(({ is_published: _p, course_id: _c, ...x }: Row) => x),
      courses,
      plans: plans.map((p: Row) => ({ ...p, price_per_lesson: Number(p.price_per_lesson), total: Number(p.price_per_lesson) * p.lessons_count })),
      reviews: reviews.map(({ is_published: _p, course_id: _c, ...r }: Row) => r),
      contacts,
    };
  }

  async course(idValue: unknown) {
    const courseId = id(idValue);
    const [course] = await q('SELECT id, title, summary, icon, theme FROM courses WHERE id = ? AND on_site = 1', [courseId]);
    if (!course) throw notFound('Курс не знайдено');
    const steps: Row[] = await q('SELECT id, title, description FROM roadmap_steps WHERE course_id = ? ORDER BY position, id', [courseId]);
    const subs: Row[] = steps.length
      ? await q(`SELECT step_id, title FROM roadmap_substeps WHERE step_id IN (?) ORDER BY position, id`, [steps.map((s) => s.id)])
      : [];
    return {
      ...course,
      steps: steps.map((s) => ({ ...s, topics: subs.filter((x) => x.step_id === s.id).map((x) => x.title) })),
      reviews: await q(`${REVIEW_SELECT} WHERE r.is_published = 1 AND r.course_id = ? ORDER BY r.id DESC`, [courseId]),
    };
  }

  /** Скрін проєкту: лише якщо він в опублікованому проєкті. */
  async image(name: string, res: Response) {
    if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
    const [img] = await q(
      `SELECT i.* FROM site_images i WHERE i.stored_name = ? AND EXISTS (SELECT 1 FROM projects p WHERE p.image = i.stored_name AND p.is_published = 1)`,
      [name]
    );
    if (!img) throw notFound('Картинку не знайдено');
    await sendStored(res, { storedName: img.stored_name, mime: img.mime, size: img.size, filename: 'project', inline: true, cache: 'public, max-age=604800' }, 'Картинку не знайдено');
  }

  async lead(body: any) {
    const b = body ?? {};
    // Пастка для ботів: приховане поле заповнюють лише вони. Відповідаємо «успіх», нічого не зберігаючи.
    if (typeof b.website === 'string' && b.website.trim()) return { ok: true };
    const lead = {
      name: str(b.name, "Ім'я", { max: 80 }).replace(/\s+/g, ' '),
      phone: normalizePhone(b.phone),
      note: str(b.note, 'Додатково', { max: 500, required: false }),
    };
    if (lead.name.length < 2) throw bad("Вкажіть ім'я");
    const r = await q('INSERT INTO leads SET ?', [lead]);
    if (await sendToTelegram(lead)) await q('UPDATE leads SET telegram_sent = 1 WHERE id = ?', [r.insertId]);
    return { ok: true };
  }
}

/** Кабінет менеджера: заявки, відгуки, що показувати на сайті, контакти. */
@Injectable()
export class SiteAdminService {
  leads() {
    return q('SELECT * FROM leads ORDER BY (status = \'new\') DESC, id DESC LIMIT 500');
  }

  async newLeads() {
    const [{ n }] = await q("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'");
    return { count: Number(n) };
  }

  async setLead(idValue: unknown, body: any) {
    const leadId = id(idValue);
    const status = body?.status;
    if (status !== 'new' && status !== 'done') throw bad('Невідомий стан');
    const r = await q('UPDATE leads SET status = ? WHERE id = ?', [status, leadId]);
    if (!r.affectedRows) throw notFound();
    return (await q('SELECT * FROM leads WHERE id = ?', [leadId]))[0];
  }

  async removeLead(idValue: unknown) {
    await q('DELETE FROM leads WHERE id = ?', [id(idValue)]);
    return { ok: true };
  }

  reviews() {
    return q(`${REVIEW_SELECT} ORDER BY r.id DESC`);
  }

  async createReview(body: any) {
    const r = await q('INSERT INTO reviews SET ?', [parseReview(body ?? {})]);
    return (await q(`${REVIEW_SELECT} WHERE r.id = ?`, [r.insertId]))[0];
  }

  async updateReview(idValue: unknown, body: any) {
    const reviewId = id(idValue);
    const [cur] = await q('SELECT * FROM reviews WHERE id = ?', [reviewId]);
    if (!cur) throw notFound();
    await q('UPDATE reviews SET ? WHERE id = ?', [parseReview({ ...cur, ...(body ?? {}) }), reviewId]);
    return (await q(`${REVIEW_SELECT} WHERE r.id = ?`, [reviewId]))[0];
  }

  async removeReview(idValue: unknown) {
    await q('DELETE FROM reviews WHERE id = ?', [id(idValue)]);
    return { ok: true };
  }

  projects() {
    return q(`${PROJECT_SELECT} ORDER BY p.id DESC`);
  }

  async createProject(body: any) {
    const r = await q('INSERT INTO projects SET ?', [await parseProject(body ?? {})]);
    return (await q(`${PROJECT_SELECT} WHERE p.id = ?`, [r.insertId]))[0];
  }

  async updateProject(idValue: unknown, body: any) {
    const projectId = id(idValue);
    const [cur] = await q('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!cur) throw notFound();
    const next = await parseProject({ ...cur, ...(body ?? {}) });
    await q('UPDATE projects SET ? WHERE id = ?', [next, projectId]);
    if (cur.image !== next.image) await dropImage(cur.image);
    return (await q(`${PROJECT_SELECT} WHERE p.id = ?`, [projectId]))[0];
  }

  async removeProject(idValue: unknown) {
    const projectId = id(idValue);
    const [cur] = await q('SELECT image FROM projects WHERE id = ?', [projectId]);
    await q('DELETE FROM projects WHERE id = ?', [projectId]);
    if (cur) await dropImage(cur.image);
    return { ok: true };
  }

  async uploadImage(req: Request, res: Response) {
    const err = await new Promise<unknown>((resolve) => upload(req, res, resolve));
    try {
      if (err) throw (err as multer.MulterError).code === 'LIMIT_FILE_SIZE' ? bad(`Картинка завелика: максимум ${MAX_IMAGE_MB} МБ`) : bad('Не вдалося завантажити картинку');
      if (!req.file) throw bad('Оберіть картинку');
      const mime = imageMime(await readHead(req.file.path));
      if (!mime) throw bad('Картинка: PNG, JPG, WEBP або GIF');
      await persistFile(req.file.filename);
      await q('INSERT INTO site_images (stored_name, mime, size) VALUES (?, ?, ?)', [req.file.filename, mime, req.file.size]);
      return { image: req.file.filename };
    } catch (e) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      throw e;
    }
  }

  /** Менеджер бачить і скріни неопублікованих проєктів. */
  async sendImage(name: string, res: Response) {
    if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
    const [img] = await q('SELECT * FROM site_images WHERE stored_name = ?', [name]);
    if (!img) throw notFound('Картинку не знайдено');
    await sendStored(res, { storedName: img.stored_name, mime: img.mime, size: img.size, filename: 'project', inline: true, cache: 'private, max-age=86400' }, 'Картинку не знайдено');
  }

  async showcase() {
    const [courses, plans] = await Promise.all([
      q('SELECT id, title, icon, theme, on_site FROM courses ORDER BY title'),
      q('SELECT id, name, lessons_count, price_per_lesson, color, is_active, on_site FROM plans ORDER BY is_active DESC, lessons_count'),
    ]);
    return { courses, plans };
  }

  /** Повний список того, що показувати: усе інше ховається. */
  async setShowcase(body: any) {
    const courseIds = idList(body?.course_ids ?? [], 'Курси');
    const planIds = idList(body?.plan_ids ?? [], 'Абонементи');
    await q('UPDATE courses SET on_site = (id IN (?))', [courseIds.length ? courseIds : [0]]);
    await q('UPDATE plans SET on_site = (id IN (?))', [planIds.length ? planIds : [0]]);
    return this.showcase();
  }

  settings() {
    return settings();
  }

  async setSettings(body: any) {
    const b = body ?? {};
    for (const key of SETTINGS) {
      if (!(key in b)) continue;
      let value = str(b[key], key, { max: SETTING_MAX[key], required: false }) ?? '';
      if (key === 'phone' && value) value = normalizePhone(value);
      if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw bad('Перевірте email');
      if (SOCIAL_NAME[key] && value && !/^(https:\/\/|@)?[\w./?=&%-]+$/.test(value)) throw bad(`Перевірте ${SOCIAL_NAME[key]}`);
      if (value) await q('INSERT INTO site_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [key, value]);
      else await q('DELETE FROM site_settings WHERE name = ?', [key]);
    }
    return settings();
  }
}
