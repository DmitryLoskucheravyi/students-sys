import { Injectable } from '@nestjs/common';
import { type Query, type Row, q, tx } from '../../db.js';
import { addDays, addMinutes, bad, hhmm, id, idList, int, isoDate, notFound, str, today, weekdayOf } from '../../lib.js';
import { type Slot, assertNoConflicts, daysOf, ensureSessions, removeFutureSessions, rosterOf } from '../../schedule.js';
import type { User } from '../../common/auth.js';

/* Урок — шаблон: назва, курс, тривалість, місце й вчитель за замовчуванням. Учнів і часу в уроці немає. */

const LESSON_SELECT = `
  SELECT l.id, l.title, l.course_id, l.duration_min, l.location, l.note, l.is_active, l.created_at,
         c.title AS course_title, l.teacher_id AS default_teacher_id, dt.name AS default_teacher_name
    FROM lessons l
    LEFT JOIN courses c ON c.id = l.course_id
    LEFT JOIN users dt ON dt.id = l.teacher_id`;

const has = (b: object, k: string) => Object.prototype.hasOwnProperty.call(b, k);

/** Поля, яких немає в запиті, лишаються як були. */
async function parseLesson(b: any, cur: Row = {}) {
  const pick = (k: string) => (has(b, k) ? b[k] : cur[k]);
  const teacherRaw = has(b, 'default_teacher_id') ? b.default_teacher_id : cur.teacher_id;
  const lesson = {
    title: str(pick('title'), 'Назва', { max: 120 }),
    course_id: pick('course_id') ? id(pick('course_id'), 'Курс') : null,
    teacher_id: teacherRaw ? id(teacherRaw, 'Вчитель за замовчуванням') : null,
    duration_min: int(pick('duration_min') ?? 60, 'Тривалість', { min: 10, max: 480 }),
    location: str(pick('location'), 'Місце', { max: 200, required: false }),
    note: str(pick('note'), 'Нотатка', { max: 500, required: false }),
  };
  if (lesson.course_id) {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [lesson.course_id]);
    if (!c) throw bad('Курс не знайдено');
  }
  if (lesson.teacher_id && lesson.teacher_id !== cur.teacher_id) {
    const [t] = await q(`SELECT id FROM users WHERE id=? AND role='teacher' AND is_active=1`, [lesson.teacher_id]);
    if (!t) throw bad('Вчителя не знайдено');
  }
  return lesson;
}

const lessonById = async (lessonId: number): Promise<Row> => (await q(`${LESSON_SELECT} WHERE l.id=?`, [lessonId]))[0];

@Injectable()
export class LessonsService {
  list(user: User) {
    const isTeacher = user.role === 'teacher';
    return q(
      `${LESSON_SELECT}
       ${isTeacher ? 'WHERE EXISTS (SELECT 1 FROM lesson_schedules sc WHERE sc.lesson_id = l.id AND sc.teacher_id = ? AND sc.is_active = 1)' : ''}
       ORDER BY l.is_active DESC, l.title`,
      isTeacher ? [user.id] : []
    );
  }

  async create(body: any) {
    const r = await q('INSERT INTO lessons SET ?', [await parseLesson(body ?? {})]);
    return lessonById(r.insertId);
  }

  async update(idValue: unknown, body: any) {
    const lessonId = id(idValue);
    const [cur] = await q('SELECT * FROM lessons WHERE id=?', [lessonId]);
    if (!cur) throw notFound('Урок не знайдено');
    const lesson = await parseLesson(body ?? {}, cur);

    await tx(async (t) => {
      // Нова тривалість змінює всі майбутні заняття: перевіряємо накладки кожної постановки окремо.
      if (lesson.duration_min !== cur.duration_min) {
        const future: Row[] = await t(
          `SELECT se.id, se.starts_at, se.schedule_id, sc.teacher_id FROM lesson_sessions se
             JOIN lesson_schedules sc ON sc.id = se.schedule_id
            WHERE se.lesson_id=? AND se.status='scheduled' AND se.starts_at > NOW()`,
          [lessonId]
        );
        for (const scheduleId of new Set(future.map((s) => s.schedule_id as number))) {
          const own = future.filter((s) => s.schedule_id === scheduleId);
          await assertNoConflicts(
            {
              teacherId: own[0].teacher_id,
              studentIds: await rosterOf(scheduleId, t),
              slots: own.map((s) => ({ start: s.starts_at, end: addMinutes(s.starts_at, lesson.duration_min) })),
              excludeScheduleId: scheduleId,
            },
            t
          );
        }
        for (const s of future) {
          await t('UPDATE lesson_sessions SET ends_at=? WHERE id=?', [addMinutes(s.starts_at, lesson.duration_min), s.id]);
        }
      }
      await t('UPDATE lessons SET ? WHERE id=?', [lesson, lessonId]);
    });
    return lessonById(lessonId);
  }

  /** Архів зупиняє розклад, але зберігає історію занять, домашні та списання. */
  async archive(idValue: unknown) {
    const lessonId = id(idValue);
    await tx(async (t) => {
      await t('UPDATE lessons SET is_active=0 WHERE id=?', [lessonId]);
      await t('UPDATE lesson_schedules SET is_active=0 WHERE lesson_id=?', [lessonId]);
      await removeFutureSessions('lesson_id=?', [lessonId], t);
    });
    return { ok: true };
  }

  async restore(idValue: unknown) {
    await q('UPDATE lessons SET is_active=1 WHERE id=?', [id(idValue)]);
    return { ok: true };
  }
}

/* Постановка в розклад: урок + вчитель + учні + час, постійно або одноразово */

const CONFLICT_HORIZON_DAYS = 182;

/**
 * Вчитель, кабінет і учні постановки. Вимкнених, які вже в постановці, лишаємо: інакше її не відредагувати.
 * Кабінет без явного вибору: основний кабінет вчителя (для нової постановки чи нового вчителя), інакше поточний.
 */
async function parsePeople(b: any, scheduleId = 0, cur: Row = { teacher_id: null, room_id: null }) {
  const teacherRaw = has(b, 'teacher_id') ? b.teacher_id : cur.teacher_id;
  const teacherId: number | null = teacherRaw ? id(teacherRaw, 'Вчитель') : null;
  const studentIds = has(b, 'student_ids') ? idList(b.student_ids ?? [], 'Учні') : await rosterOf(scheduleId);
  if (teacherId && teacherId !== cur.teacher_id) {
    const [t] = await q(`SELECT id FROM users WHERE id=? AND role='teacher' AND is_active=1`, [teacherId]);
    if (!t) throw bad('Вчителя не знайдено');
  }
  let roomId: number | null;
  if (has(b, 'room_id')) roomId = b.room_id ? id(b.room_id, 'Кабінет') : null;
  else if (teacherId && (!scheduleId || teacherId !== cur.teacher_id)) {
    const [main] = await q('SELECT id FROM teacher_rooms WHERE teacher_id=? ORDER BY is_default DESC, position, id LIMIT 1', [teacherId]);
    roomId = main?.id ?? null;
  } else roomId = teacherId ? cur.room_id : null;
  if (roomId) {
    const [room] = await q('SELECT teacher_id FROM teacher_rooms WHERE id=?', [roomId]);
    if (!room || room.teacher_id !== teacherId) throw bad('Кабінет не належить цьому вчителю');
  }
  if (studentIds.length) {
    const found = await q(
      `SELECT id FROM users u WHERE id IN (?) AND role='student' AND (is_active=1
         OR EXISTS (SELECT 1 FROM schedule_students ss WHERE ss.student_id = u.id AND ss.schedule_id = ?))`,
      [studentIds, scheduleId]
    );
    if (found.length !== studentIds.length) throw bad('Деяких учнів не знайдено');
  }
  return { teacherId, studentIds, roomId };
}

async function saveRoster(t: Query, scheduleId: number, studentIds: number[]) {
  await t('DELETE FROM schedule_students WHERE schedule_id=?', [scheduleId]);
  if (studentIds.length) {
    await t('INSERT INTO schedule_students (schedule_id, student_id) VALUES ?', [studentIds.map((s) => [scheduleId, s])]);
  }
}

const PLACEMENT_SELECT = `
  SELECT sc.id, sc.lesson_id, sc.kind, sc.weekday, sc.weekdays, sc.start_date, sc.end_date, sc.teacher_id,
         TIME_FORMAT(COALESCE(TIME(se.starts_at), sc.start_time), '%H:%i') AS time,
         DATE(se.starts_at) AS once_date,
         l.title, l.duration_min, l.course_id, u.name AS teacher_name,
         sc.room_id, r.service AS room_service, r.url AS room_url
    FROM lesson_schedules sc
    JOIN lessons l ON l.id = sc.lesson_id
    LEFT JOIN users u ON u.id = sc.teacher_id
    LEFT JOIN teacher_rooms r ON r.id = sc.room_id
    LEFT JOIN lesson_sessions se ON sc.kind = 'once' AND se.schedule_id = sc.id`;

async function withRoster(rows: Row[]): Promise<Row[]> {
  if (!rows.length) return [];
  const people: Row[] = await q(
    `SELECT ss.schedule_id, u.id, u.name, u.avatar, u.is_active FROM schedule_students ss JOIN users u ON u.id = ss.student_id
      WHERE ss.schedule_id IN (?) ORDER BY u.name`,
    [rows.map((r) => r.id)]
  );
  return rows.map(({ weekday, weekdays, once_date: onceDate, ...r }) => ({
    ...r,
    weekdays: daysOf({ weekday, weekdays }),
    start_date: r.kind === 'once' ? onceDate ?? r.start_date : r.start_date,
    students: people.filter((p) => p.schedule_id === r.id).map(({ id: sid, name, avatar, is_active: active }) => ({ id: sid, name, avatar, is_active: active })),
  }));
}

@Injectable()
export class SchedulesService {
  /** Чинні постановки: для форми домашнього та картки заняття. */
  async list(user: User) {
    const isTeacher = user.role === 'teacher';
    const rows: Row[] = await q(
      `${PLACEMENT_SELECT}
        WHERE sc.is_active = 1 AND l.is_active = 1
          AND ((sc.kind = 'weekly' AND (sc.end_date IS NULL OR sc.end_date >= CURDATE()))
            OR (sc.kind = 'once' AND se.status <> 'cancelled' AND se.starts_at >= CURDATE() - INTERVAL 30 DAY))
          ${isTeacher ? 'AND sc.teacher_id = ?' : ''}
        ORDER BY l.title, sc.id`,
      isTeacher ? [user.id] : []
    );
    return withRoster(rows);
  }

  async get(user: User, idValue: unknown) {
    const [row] = await withRoster(await q(`${PLACEMENT_SELECT} WHERE sc.id=?`, [id(idValue)]));
    if (!row || (user.role === 'teacher' && row.teacher_id !== user.id)) throw notFound('Розклад не знайдено');
    return row;
  }

  async create(body: any) {
    const b = body ?? {};
    const lessonId = id(b.lesson_id, 'Урок');
    const [lesson] = await q('SELECT * FROM lessons WHERE id=? AND is_active=1', [lessonId]);
    if (!lesson) throw bad('Урок не знайдено');
    const time = hhmm(b.time);
    const { teacherId, studentIds, roomId } = await parsePeople(b);

    if (b.kind === 'once') {
      const date = isoDate(b.date);
      const start = `${date} ${time}:00`;
      const end = addMinutes(start, lesson.duration_min);
      await assertNoConflicts({ teacherId, studentIds, slots: [{ start, end }] });
      return tx(async (t) => {
        const r = await t('INSERT INTO lesson_schedules SET ?', [{
          lesson_id: lessonId, teacher_id: teacherId, room_id: roomId, kind: 'once', start_time: time, start_date: date,
        }]);
        await saveRoster(t, r.insertId, studentIds);
        const s = await t(
          'INSERT INTO lesson_sessions (lesson_id, schedule_id, original_starts_at, starts_at, ends_at) VALUES (?,?,?,?,?)',
          [lessonId, r.insertId, start, start, end]
        );
        return { schedule_id: r.insertId, session_id: s.insertId };
      });
    }

    if (b.kind !== 'weekly') throw bad('Оберіть: постійно або одноразово');
    const weekdays = idList(b.weekdays ?? [], 'Дні тижня').sort();
    if (!weekdays.length || weekdays.some((d) => d > 7)) throw bad('Оберіть дні тижня');
    const startDate = b.start_date ? isoDate(b.start_date, 'Початок') : today();
    const endDate = b.end_date ? isoDate(b.end_date, 'Кінець') : null;
    if (endDate && endDate < startDate) throw bad('Кінець раніше за початок');

    // Спершу створюємо заняття інших постійних постановок, щоб побачити всі накладки.
    const horizon = addDays(startDate, CONFLICT_HORIZON_DAYS);
    await ensureSessions(horizon);
    const until = endDate && endDate < horizon ? endDate : horizon;
    const slots: Slot[] = [];
    for (let d = startDate; d <= until; d = addDays(d, 1)) {
      if (weekdays.includes(weekdayOf(d))) {
        const start = `${d} ${time}:00`;
        slots.push({ start, end: addMinutes(start, lesson.duration_min) });
      }
    }
    if (!slots.length) throw bad('У цьому проміжку немає обраних днів');
    await assertNoConflicts({ teacherId, studentIds, slots });

    const scheduleId = await tx(async (t) => {
      const r = await t('INSERT INTO lesson_schedules SET ?', [{
        lesson_id: lessonId, teacher_id: teacherId, room_id: roomId, kind: 'weekly', weekday: weekdays[0], weekdays: weekdays.join(','),
        start_time: time, start_date: startDate, end_date: endDate,
      }]);
      await saveRoster(t, r.insertId, studentIds);
      return r.insertId as number;
    });
    await ensureSessions(horizon);
    return { schedule_id: scheduleId };
  }

  /** Новий вчитель чи склад діють на майбутні заняття постановки; минулі й списання не змінюються. */
  async update(idValue: unknown, body: any) {
    const scheduleId = id(idValue);
    const [cur] = await q('SELECT * FROM lesson_schedules WHERE id=?', [scheduleId]);
    if (!cur) throw notFound('Розклад не знайдено');
    const { teacherId, studentIds, roomId } = await parsePeople(body ?? {}, scheduleId, cur);
    await tx(async (t) => {
      const future: Row[] = await t(
        `SELECT starts_at, ends_at FROM lesson_sessions WHERE schedule_id=? AND status='scheduled' AND starts_at > NOW()`,
        [scheduleId]
      );
      await assertNoConflicts(
        { teacherId, studentIds, slots: future.map((s) => ({ start: s.starts_at, end: s.ends_at })), excludeScheduleId: scheduleId },
        t
      );
      await t('UPDATE lesson_schedules SET teacher_id=?, room_id=? WHERE id=?', [teacherId, roomId, scheduleId]);
      await saveRoster(t, scheduleId, studentIds);
    });
    const [row] = await withRoster(await q(`${PLACEMENT_SELECT} WHERE sc.id=?`, [scheduleId]));
    return row;
  }

  /** Минулі заняття лишаються; майбутні зникають із календаря. */
  async remove(idValue: unknown) {
    const scheduleId = id(idValue);
    const [s] = await q('SELECT id FROM lesson_schedules WHERE id=?', [scheduleId]);
    if (!s) throw notFound();
    await tx(async (t) => {
      await t('UPDATE lesson_schedules SET is_active=0, end_date=CURDATE() WHERE id=?', [scheduleId]);
      await removeFutureSessions('schedule_id=?', [scheduleId], t);
    });
    return { ok: true };
  }
}
