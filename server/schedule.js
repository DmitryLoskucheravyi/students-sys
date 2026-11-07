import { q as defaultQ } from './db.js';
import { addDays, addMinutes, conflict, humanDT, today, weekdayOf } from './lib.js';

export const MAX_HORIZON_DAYS = 400;

/** Створює заняття постійних уроків до дати `until`. Вже створені не чіпає. */
export async function ensureSessions(until, q = defaultQ) {
  const limit = addDays(today(), MAX_HORIZON_DAYS);
  const target = until > limit ? limit : until;
  const schedules = await q(
    `SELECT s.id, s.lesson_id, s.weekday, TIME_FORMAT(s.start_time, '%H:%i') AS time,
            s.start_date, s.end_date, s.materialized_until, l.duration_min
       FROM lesson_schedules s JOIN lessons l ON l.id = s.lesson_id
      WHERE s.kind = 'weekly' AND s.is_active = 1 AND l.is_active = 1
        AND (s.materialized_until IS NULL OR s.materialized_until < ?)`,
    [target]
  );
  for (const s of schedules) {
    const from = s.materialized_until ? addDays(s.materialized_until, 1) : s.start_date;
    const to = s.end_date && s.end_date < target ? s.end_date : target;
    const rows = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (weekdayOf(d) !== s.weekday) continue;
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

/** Шукає накладки вчителя та учнів на проміжки `slots` і зупиняє дію зрозумілою помилкою. */
export async function assertNoConflicts(
  { teacherId, studentIds = [], slots, excludeSessionId = 0, excludeLessonId = 0 },
  q = defaultQ
) {
  if (!slots.length) return;
  const minStart = slots.reduce((a, s) => (s.start < a ? s.start : a), slots[0].start);
  const maxEnd = slots.reduce((a, s) => (s.end > a ? s.end : a), slots[0].end);
  // Урок без вчителя перевіряємо лише на накладки учнів.
  const busy = !teacherId ? [] : await q(
    `SELECT se.starts_at, se.ends_at, l.title, l.teacher_id, u.name AS teacher_name
       FROM lesson_sessions se
       JOIN lessons l ON l.id = se.lesson_id
       JOIN users u ON u.id = l.teacher_id
      WHERE se.status <> 'cancelled' AND se.starts_at < ? AND se.ends_at > ?
        AND se.id <> ? AND l.id <> ? AND l.teacher_id = ?`,
    [maxEnd, minStart, excludeSessionId, excludeLessonId, teacherId]
  );
  for (const slot of slots) {
    const hit = busy.find((b) => b.starts_at < slot.end && b.ends_at > slot.start);
    if (hit) {
      throw conflict(`${hit.teacher_name} вже веде «${hit.title}» ${humanDT(hit.starts_at)}`);
    }
  }
  if (!studentIds.length) return;
  const busyStudents = await q(
    `SELECT se.starts_at, se.ends_at, l.title, u.name AS student_name
       FROM lesson_sessions se
       JOIN lessons l ON l.id = se.lesson_id
       JOIN lesson_students ls ON ls.lesson_id = l.id
       JOIN users u ON u.id = ls.student_id
      WHERE se.status <> 'cancelled' AND se.starts_at < ? AND se.ends_at > ?
        AND se.id <> ? AND l.id <> ? AND ls.student_id IN (?)`,
    [maxEnd, minStart, excludeSessionId, excludeLessonId, studentIds]
  );
  for (const slot of slots) {
    const hit = busyStudents.find((b) => b.starts_at < slot.end && b.ends_at > slot.start);
    if (hit) {
      throw conflict(`${hit.student_name} має «${hit.title}» ${humanDT(hit.starts_at)}`);
    }
  }
}

/** Прибирає майбутні заняття правила: минулі лишаються в історії. */
export async function removeFutureSessions(where, params, q = defaultQ) {
  await q(
    `DELETE FROM lesson_sessions WHERE ${where} AND status = 'scheduled' AND starts_at > NOW()`,
    params
  );
}
