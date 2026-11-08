import { q as defaultQ, type Query, type Row } from './db.js';
import { addDays, addMinutes, conflict, humanDT, today, weekdayOf } from './lib.js';

export const MAX_HORIZON_DAYS = 400;

/** Дні постановки: нові записи мають список, старі — один день. */
export const daysOf = (s: { weekday?: unknown; weekdays?: unknown }): number[] => (s.weekdays ? String(s.weekdays).split(',').map(Number) : s.weekday ? [Number(s.weekday)] : []);

/** Створює заняття постійних постановок до дати `until`. Вже створені не чіпає. */
export async function ensureSessions(until: string, q: Query = defaultQ): Promise<void> {
  const limit = addDays(today(), MAX_HORIZON_DAYS);
  const target = until > limit ? limit : until;
  const schedules: Row[] = await q(
    `SELECT s.id, s.lesson_id, s.weekday, s.weekdays, TIME_FORMAT(s.start_time, '%H:%i') AS time,
            s.start_date, s.end_date, s.materialized_until, l.duration_min
       FROM lesson_schedules s JOIN lessons l ON l.id = s.lesson_id
      WHERE s.kind = 'weekly' AND s.is_active = 1 AND l.is_active = 1
        AND (s.materialized_until IS NULL OR s.materialized_until < ?)`,
    [target]
  );
  for (const s of schedules) {
    const days = daysOf(s);
    const from = s.materialized_until ? addDays(s.materialized_until, 1) : s.start_date;
    const to = s.end_date && s.end_date < target ? s.end_date : target;
    const rows: unknown[][] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!days.includes(weekdayOf(d))) continue;
      const start = `${d} ${s.time}:00`;
      rows.push([s.lesson_id, s.id, start, start, addMinutes(start, s.duration_min)]);
    }
    if (rows.length) {
      await q(
        `INSERT IGNORE INTO lesson_sessions (lesson_id, schedule_id, original_starts_at, starts_at, ends_at) VALUES ?`,
        [rows]
      );
    }
    await q('UPDATE lesson_schedules SET materialized_until=? WHERE id=?', [target, s.id]);
  }
}

/**
 * Шукає накладки вчителя та учнів на проміжки `slots` і зупиняє дію зрозумілою помилкою.
 * Заняття самої постановки, яку змінюють, не рахуються (excludeScheduleId).
 */
export interface Slot { start: string; end: string }
export async function assertNoConflicts(
  { teacherId, studentIds = [], slots, excludeSessionId = 0, excludeScheduleId = 0 }:
    { teacherId: number | null; studentIds?: number[]; slots: Slot[]; excludeSessionId?: number; excludeScheduleId?: number },
  q: Query = defaultQ
): Promise<void> {
  if (!slots.length) return;
  const minStart = slots.reduce((a, s) => (s.start < a ? s.start : a), slots[0].start);
  const maxEnd = slots.reduce((a, s) => (s.end > a ? s.end : a), slots[0].end);
  // Постановка без вчителя перевіряється лише на накладки учнів.
  const busy: Row[] = !teacherId ? [] : await q(
    `SELECT se.starts_at, se.ends_at, l.title, u.name AS teacher_name
       FROM lesson_sessions se
       JOIN lessons l ON l.id = se.lesson_id
       JOIN lesson_schedules sc ON sc.id = se.schedule_id
       JOIN users u ON u.id = sc.teacher_id
      WHERE se.status <> 'cancelled' AND se.starts_at < ? AND se.ends_at > ?
        AND se.id <> ? AND sc.id <> ? AND sc.teacher_id = ?`,
    [maxEnd, minStart, excludeSessionId, excludeScheduleId, teacherId]
  );
  for (const slot of slots) {
    const hit = busy.find((b) => b.starts_at < slot.end && b.ends_at > slot.start);
    if (hit) {
      throw conflict(`${hit.teacher_name} вже веде «${hit.title}» ${humanDT(hit.starts_at)}`);
    }
  }
  if (!studentIds.length) return;
  const busyStudents: Row[] = await q(
    `SELECT se.starts_at, se.ends_at, l.title, u.name AS student_name
       FROM lesson_sessions se
       JOIN lessons l ON l.id = se.lesson_id
       JOIN schedule_students ss ON ss.schedule_id = se.schedule_id
       JOIN users u ON u.id = ss.student_id
      WHERE se.status <> 'cancelled' AND se.starts_at < ? AND se.ends_at > ?
        AND se.id <> ? AND se.schedule_id <> ? AND ss.student_id IN (?)`,
    [maxEnd, minStart, excludeSessionId, excludeScheduleId, studentIds]
  );
  for (const slot of slots) {
    const hit = busyStudents.find((b) => b.starts_at < slot.end && b.ends_at > slot.start);
    if (hit) {
      throw conflict(`${hit.student_name} має «${hit.title}» ${humanDT(hit.starts_at)}`);
    }
  }
}

/** Прибирає майбутні заняття правила: минулі лишаються в історії. */
export async function removeFutureSessions(where: string, params: unknown[], q: Query = defaultQ): Promise<void> {
  await q(
    `DELETE FROM lesson_sessions WHERE ${where} AND status = 'scheduled' AND starts_at > NOW()`,
    params
  );
}

/** Учні постановки. */
export async function rosterOf(scheduleId: number, q: Query = defaultQ): Promise<number[]> {
  const rows = await q('SELECT student_id FROM schedule_students WHERE schedule_id=?', [scheduleId]);
  return rows.map((r: Row) => r.student_id);
}
