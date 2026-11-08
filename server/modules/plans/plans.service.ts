import { Injectable } from '@nestjs/common';
import { type Row, q, tx } from '../../db.js';
import { addDays, bad, forbidden, id, int, isoDate, money, notFound, str, today } from '../../lib.js';
import type { User } from '../../common/auth.js';

/** Кольори квитка. Має збігатися з PLAN_COLORS у client/src/pages/Subscriptions.jsx. */
export const PLAN_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink', 'ink'];

function parsePlan(b: any) {
  if (b.color != null && !PLAN_COLORS.includes(b.color)) throw bad('Невідомий колір');
  return {
    color: (b.color as string | undefined) ?? 'red',
    name: str(b.name, 'Назва', { max: 120 }),
    lessons_count: int(b.lessons_count, 'Кількість уроків', { min: 1, max: 500 }),
    price_per_lesson: money(b.price_per_lesson, 'Вартість заняття'),
    valid_days: int(b.valid_days, 'Термін дії', { min: 1, max: 1095 }),
  };
}

const SUB_SELECT = `
  SELECT s.*, u.name AS student_name, u.avatar AS student_avatar, COALESCE(pl.color, 'red') AS color,
         (s.lessons_total - s.lessons_used) AS lessons_left,
         (s.lessons_total * s.price_per_lesson) AS total_price,
         (s.expires_on < CURDATE()) AS is_expired
    FROM subscriptions s JOIN users u ON u.id = s.student_id
    LEFT JOIN plans pl ON pl.id = s.plan_id`;

const subById = async (subId: number): Promise<Row> => (await q(`${SUB_SELECT} WHERE s.id=?`, [subId]))[0];

/** Абонементи-шаблони: скільки уроків, за скільки й на який термін. */
@Injectable()
export class PlansService {
  list() {
    return q(
      `SELECT p.*, (SELECT COUNT(*) FROM subscriptions s
                     WHERE s.plan_id = p.id AND s.status='active' AND s.expires_on >= CURDATE()) AS active_count
         FROM plans p ORDER BY p.is_active DESC, p.lessons_count`
    );
  }

  async create(body: any) {
    const p = parsePlan(body ?? {});
    const r = await q('INSERT INTO plans SET ?', [p]);
    return (await q('SELECT * FROM plans WHERE id=?', [r.insertId]))[0];
  }

  async update(idValue: unknown, body: any) {
    const planId = id(idValue);
    const [cur] = await q('SELECT * FROM plans WHERE id=?', [planId]);
    if (!cur) throw notFound();
    const b = body ?? {};
    const p = parsePlan({ ...cur, ...b });
    const is_active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : cur.is_active;
    await q('UPDATE plans SET ? WHERE id=?', [{ ...p, is_active }, planId]);
    return (await q('SELECT * FROM plans WHERE id=?', [planId]))[0];
  }
}

/** Абонементи учнів: видача, правки, ручні списання та історія. */
@Injectable()
export class SubscriptionsService {
  async list(user: User, studentQuery: unknown) {
    const { role, id: me } = user;
    if (role === 'teacher') throw forbidden();
    const studentId = role === 'student' ? me : studentQuery ? id(studentQuery) : null;
    return q(
      `${SUB_SELECT} ${studentId ? 'WHERE s.student_id = ?' : ''}
        ORDER BY (s.status='active' AND s.expires_on >= CURDATE()) DESC, s.expires_on DESC, s.id DESC`,
      studentId ? [studentId] : []
    );
  }

  /** Історія: проведені заняття й ручні списання разом, від нових до старих. */
  async charges(user: User, idValue: unknown) {
    const subId = id(idValue);
    const [sub] = await q('SELECT student_id FROM subscriptions WHERE id=?', [subId]);
    if (!sub) throw notFound();
    const { role, id: me } = user;
    if (role === 'teacher' || (role === 'student' && sub.student_id !== me)) throw forbidden();
    const sessions: Row[] = await q(
      `SELECT a.session_id, a.price_charged, se.starts_at, l.title
         FROM attendance a
         JOIN lesson_sessions se ON se.id = a.session_id
         JOIN lessons l ON l.id = se.lesson_id
        WHERE a.subscription_id = ?`,
      [subId]
    );
    const manual: Row[] = await q(
      `SELECT id, lessons, price_per_lesson, done_on, note FROM subscription_writeoffs WHERE subscription_id = ?`,
      [subId]
    );
    return [
      ...sessions.map((s) => ({
        key: `s${s.session_id}`, kind: 'session', session_id: s.session_id, title: s.title,
        starts_at: s.starts_at, date: s.starts_at as string, lessons: 1, price_charged: s.price_charged,
      })),
      ...manual.map((w) => ({
        key: `w${w.id}`, kind: 'manual', writeoff_id: w.id, title: w.note || 'Списано вручну', note: w.note,
        date: `${w.done_on} 00:00:00`, lessons: w.lessons, price_charged: Math.round(w.lessons * w.price_per_lesson * 100) / 100,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Ручне списання: учень займався, але заняття немає в розкладі. Ціна береться з абонемента зараз. */
  async writeOff(user: User, idValue: unknown, body: any) {
    const subId = id(idValue);
    const lessons = int(body?.lessons ?? 1, 'Уроків', { min: 1, max: 500 });
    const doneOn = body?.date ? isoDate(body.date, 'Дата') : today();
    const note = str(body?.note, 'Коментар', { max: 300, required: false });
    await tx(async (t) => {
      const [sub] = await t('SELECT * FROM subscriptions WHERE id=? FOR UPDATE', [subId]);
      if (!sub) throw notFound('Абонемент не знайдено');
      const left = sub.lessons_total - sub.lessons_used;
      if (lessons > left) throw bad(left ? `На абонементі лишилось лише ${left}` : 'На абонементі не лишилось уроків');
      await t('UPDATE subscriptions SET lessons_used = lessons_used + ? WHERE id=?', [lessons, subId]);
      await t('INSERT INTO subscription_writeoffs SET ?', [{
        subscription_id: subId, lessons, price_per_lesson: sub.price_per_lesson, done_on: doneOn, note, created_by: user.id,
      }]);
    });
    return subById(subId);
  }

  /** Скасування ручного списання повертає уроки на абонемент. */
  async undoWriteOff(idValue: unknown, writeoffValue: unknown) {
    const subId = id(idValue);
    const writeoffId = id(writeoffValue);
    await tx(async (t) => {
      const [w] = await t('SELECT lessons FROM subscription_writeoffs WHERE id=? AND subscription_id=? FOR UPDATE', [writeoffId, subId]);
      if (!w) throw notFound('Списання не знайдено');
      await t('UPDATE subscriptions SET lessons_used = GREATEST(lessons_used - ?, 0) WHERE id=?', [w.lessons, subId]);
      await t('DELETE FROM subscription_writeoffs WHERE id=?', [writeoffId]);
    });
    return subById(subId);
  }

  async create(user: User, body: any) {
    const b = body ?? {};
    const studentId = id(b.student_id, 'Учень');
    const [student] = await q(`SELECT id FROM users WHERE id=? AND role='student' AND is_active=1`, [studentId]);
    if (!student) throw bad('Учня не знайдено');
    const [plan] = await q('SELECT * FROM plans WHERE id=? AND is_active=1', [id(b.plan_id, 'Абонемент')]);
    if (!plan) throw bad('Абонемент не знайдено');

    const startsOn = b.starts_on ? isoDate(b.starts_on, 'Початок') : today();
    const expiresOn = b.expires_on ? isoDate(b.expires_on, 'Закінчення') : addDays(startsOn, plan.valid_days);
    if (expiresOn < startsOn) throw bad('Закінчення раніше за початок');

    const lessonsTotal = b.lessons_total != null ? int(b.lessons_total, 'Уроків', { min: 1, max: 500 }) : plan.lessons_count;
    const price = b.price_per_lesson != null ? money(b.price_per_lesson, 'Вартість заняття') : Number(plan.price_per_lesson);
    const r = await q('INSERT INTO subscriptions SET ?', [{
      student_id: studentId,
      plan_id: plan.id,
      name: plan.name,
      lessons_total: lessonsTotal,
      price_per_lesson: price,
      // Знімок суми продажу: подальші правки ціни чи кількості уроків статистику не змінюють.
      sold_amount: Math.round(lessonsTotal * price * 100) / 100,
      starts_on: startsOn,
      expires_on: expiresOn,
      created_by: user.id,
    }]);
    return subById(r.insertId);
  }

  /** Нова вартість діє лише на майбутні заняття: вже списані зберігають свою ціну. */
  async update(idValue: unknown, body: any) {
    const subId = id(idValue);
    const [cur] = await q('SELECT * FROM subscriptions WHERE id=?', [subId]);
    if (!cur) throw notFound();
    const b = body ?? {};
    const patch: Row = {};
    if (b.price_per_lesson !== undefined) patch.price_per_lesson = money(b.price_per_lesson, 'Вартість заняття');
    if (b.lessons_total !== undefined) {
      patch.lessons_total = int(b.lessons_total, 'Уроків', { min: Math.max(1, cur.lessons_used), max: 500 });
    }
    if (b.expires_on !== undefined) {
      patch.expires_on = isoDate(b.expires_on, 'Закінчення');
      if (patch.expires_on < cur.starts_on) throw bad('Закінчення раніше за початок');
    }
    if (b.status !== undefined) {
      if (!['active', 'closed'].includes(b.status)) throw bad('Невідомий статус');
      patch.status = b.status;
    }
    if (Object.keys(patch).length) await q('UPDATE subscriptions SET ? WHERE id=?', [patch, subId]);
    return subById(subId);
  }
}
