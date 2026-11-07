import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { addDays, addMinutes, bad, hhmm, id, idList, int, isoDate, notFound, str, today, weekdayOf } from '../lib.js';
import { assertNoConflicts, daysOf, ensureSessions, removeFutureSessions, rosterOf } from '../schedule.js';

export const lessonsRouter = Router();
export const schedulesRouter = Router();
lessonsRouter.use(requireAuth);
schedulesRouter.use(requireAuth);

/* Урок — шаблон: назва, курс, тривалість, місце. Без людей і без часу. */

const LESSON_SELECT = `
  SELECT l.id, l.title, l.course_id, l.duration_min, l.location, l.note, l.is_active, l.created_at,
         c.title AS course_title
    FROM lessons l
    LEFT JOIN courses c ON c.id = l.course_id`;

lessonsRouter.get('/', requireRole('manager', 'teacher'), async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  res.json(
    await q(
      `${LESSON_SELECT}
       ${isTeacher ? 'WHERE EXISTS (SELECT 1 FROM lesson_schedules sc WHERE sc.lesson_id = l.id AND sc.teacher_id = ? AND sc.is_active = 1)' : ''}
       ORDER BY l.is_active DESC, l.title`,
      isTeacher ? [req.user.id] : []
    )
  );
});

/** Поля, яких немає в запиті, лишаються як були. */
async function parseLesson(b, cur = {}) {
  const pick = (k) => (Object.prototype.hasOwnProperty.call(b, k) ? b[k] : cur[k]);
  const lesson = {
    title: str(pick('title'), 'Назва', { max: 120 }),
    course_id: pick('course_id') ? id(pick('course_id'), 'Курс') : null,
    duration_min: int(pick('duration_min') ?? 60, 'Тривалість', { min: 10, max: 480 }),
    location: str(pick('location'), 'Місце', { max: 200, required: false }),
    note: str(pick('note'), 'Нотатка', { max: 500, required: false }),
  };
  if (lesson.course_id) {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [lesson.course_id]);
    if (!c) throw bad('Курс не знайдено');
  }
  return lesson;
}

lessonsRouter.post('/', requireRole('manager'), async (req, res) => {
  const r = await q('INSERT INTO lessons SET ?', [await parseLesson(req.body ?? {})]);
  res.status(201).json((await q(`${LESSON_SELECT} WHERE l.id=?`, [r.insertId]))[0]);
});

lessonsRouter.patch('/:id', requireRole('manager'), async (req, res) => {
  const lessonId = id(req.params.id);
  const [cur] = await q('SELECT * FROM lessons WHERE id=?', [lessonId]);
  if (!cur) throw notFound('Урок не знайдено');
  const lesson = await parseLesson(req.body ?? {}, cur);

  await tx(async (t) => {
    // Нова тривалість змінює всі майбутні заняття: перевіряємо накладки кожної постановки окремо.
    if (lesson.duration_min !== cur.duration_min) {
      const future = await t(
        `SELECT se.id, se.starts_at, se.schedule_id, sc.teacher_id FROM lesson_sessions se
           JOIN lesson_schedules sc ON sc.id = se.schedule_id
          WHERE se.lesson_id=? AND se.status='scheduled' AND se.starts_at > NOW()`,
        [lessonId]
      );
      for (const scheduleId of new Set(future.map((s) => s.schedule_id))) {
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
  res.json((await q(`${LESSON_SELECT} WHERE l.id=?`, [lessonId]))[0]);
});

// Архів зупиняє розклад, але зберігає історію занять, домашні та списання.
lessonsRouter.post('/:id/archive', requireRole('manager'), async (req, res) => {
  const lessonId = id(req.params.id);
  await tx(async (t) => {
    await t('UPDATE lessons SET is_active=0 WHERE id=?', [lessonId]);
    await t('UPDATE lesson_schedules SET is_active=0 WHERE lesson_id=?', [lessonId]);
    await removeFutureSessions('lesson_id=?', [lessonId], t);
  });
  res.json({ ok: true });
});

lessonsRouter.post('/:id/restore', requireRole('manager'), async (req, res) => {
  await q('UPDATE lessons SET is_active=1 WHERE id=?', [id(req.params.id)]);
  res.json({ ok: true });
});

/* Постановка в розклад: урок + вчитель + учні + час, постійно або одноразово */

const CONFLICT_HORIZON_DAYS = 182;

/** Вимкнених, які вже в постановці, лишаємо: інакше постановку не відредагувати. */
async function parsePeople(b, scheduleId = 0, cur = { teacher_id: null }) {
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const teacherRaw = has('teacher_id') ? b.teacher_id : cur.teacher_id;
  const teacherId = teacherRaw ? id(teacherRaw, 'Вчитель') : null;
  const studentIds = has('student_ids') ? idList(b.student_ids ?? [], 'Учні') : await rosterOf(scheduleId);
  if (teacherId && teacherId !== cur.teacher_id) {
    const [t] = await q(`SELECT id FROM users WHERE id=? AND role='teacher' AND is_active=1`, [teacherId]);
    if (!t) throw bad('Вчителя не знайдено');
  }
  if (studentIds.length) {
    const found = await q(
      `SELECT id FROM users u WHERE id IN (?) AND role='student' AND (is_active=1
         OR EXISTS (SELECT 1 FROM schedule_students ss WHERE ss.student_id = u.id AND ss.schedule_id = ?))`,
      [studentIds, scheduleId]
    );
    if (found.length !== studentIds.length) throw bad('Деяких учнів не знайдено');
  }
  return { teacherId, studentIds };
}

async function saveRoster(t, scheduleId, studentIds) {
  await t('DELETE FROM schedule_students WHERE schedule_id=?', [scheduleId]);
  if (studentIds.length) {
    await t('INSERT INTO schedule_students (schedule_id, student_id) VALUES ?', [studentIds.map((s) => [scheduleId, s])]);
  }
}

const PLACEMENT_SELECT = `
  SELECT sc.id, sc.lesson_id, sc.kind, sc.weekday, sc.weekdays, sc.start_date, sc.end_date, sc.teacher_id,
         TIME_FORMAT(COALESCE(TIME(se.starts_at), sc.start_time), '%H:%i') AS time,
         DATE(se.starts_at) AS once_date,
         l.title, l.duration_min, l.course_id, u.name AS teacher_name
    FROM lesson_schedules sc
    JOIN lessons l ON l.id = sc.lesson_id
    LEFT JOIN users u ON u.id = sc.teacher_id
    LEFT JOIN lesson_sessions se ON sc.kind = 'once' AND se.schedule_id = sc.id`;

async function withRoster(rows) {
  if (!rows.length) return [];
  const people = await q(
    `SELECT ss.schedule_id, u.id, u.name, u.is_active FROM schedule_students ss JOIN users u ON u.id = ss.student_id
      WHERE ss.schedule_id IN (?) ORDER BY u.name`,
    [rows.map((r) => r.id)]
  );
  return rows.map(({ weekday, weekdays, once_date: onceDate, ...r }) => ({
    ...r,
    weekdays: daysOf({ weekday, weekdays }),
    start_date: r.kind === 'once' ? onceDate ?? r.start_date : r.start_date,
    students: people.filter((p) => p.schedule_id === r.id).map(({ id: sid, name, is_active: active }) => ({ id: sid, name, is_active: active })),
  }));
}

// Чинні постановки: для форми домашнього та картки заняття.
schedulesRouter.get('/', requireRole('manager', 'teacher'), async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  const rows = await q(
    `${PLACEMENT_SELECT}
      WHERE sc.is_active = 1 AND l.is_active = 1
        AND ((sc.kind = 'weekly' AND (sc.end_date IS NULL OR sc.end_date >= CURDATE()))
          OR (sc.kind = 'once' AND se.status <> 'cancelled' AND se.starts_at >= CURDATE() - INTERVAL 30 DAY))
        ${isTeacher ? 'AND sc.teacher_id = ?' : ''}
      ORDER BY l.title, sc.id`,
    isTeacher ? [req.user.id] : []
  );
  res.json(await withRoster(rows));
});

schedulesRouter.get('/:id', requireRole('manager', 'teacher'), async (req, res) => {
  const [row] = await withRoster(await q(`${PLACEMENT_SELECT} WHERE sc.id=?`, [id(req.params.id)]));
  if (!row || (req.user.role === 'teacher' && row.teacher_id !== req.user.id)) throw notFound('Розклад не знайдено');
  res.json(row);
});

schedulesRouter.post('/', requireRole('manager'), async (req, res) => {
  const b = req.body ?? {};
  const lessonId = id(b.lesson_id, 'Урок');
  const [lesson] = await q('SELECT * FROM lessons WHERE id=? AND is_active=1', [lessonId]);
  if (!lesson) throw bad('Урок не знайдено');
  const time = hhmm(b.time);
  const { teacherId, studentIds } = await parsePeople(b);

  if (b.kind === 'once') {
    const date = isoDate(b.date);
    const start = `${date} ${time}:00`;
    const end = addMinutes(start, lesson.duration_min);
    await assertNoConflicts({ teacherId, studentIds, slots: [{ start, end }] });
    const created = await tx(async (t) => {
      const r = await t('INSERT INTO lesson_schedules SET ?', [{
        lesson_id: lessonId, teacher_id: teacherId, kind: 'once', start_time: time, start_date: date,
      }]);
      await saveRoster(t, r.insertId, studentIds);
      const s = await t(
        'INSERT INTO lesson_sessions (lesson_id, schedule_id, original_starts_at, starts_at, ends_at) VALUES (?,?,?,?,?)',
        [lessonId, r.insertId, start, start, end]
      );
      return { schedule_id: r.insertId, session_id: s.insertId };
    });
    return res.status(201).json(created);
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
  const slots = [];
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
      lesson_id: lessonId, teacher_id: teacherId, kind: 'weekly', weekday: weekdays[0], weekdays: weekdays.join(','),
      start_time: time, start_date: startDate, end_date: endDate,
    }]);
    await saveRoster(t, r.insertId, studentIds);
    return r.insertId;
  });
  await ensureSessions(horizon);
  res.status(201).json({ schedule_id: scheduleId });
});

// Новий вчитель чи склад діють на майбутні заняття постановки; минулі й списання не змінюються.
schedulesRouter.patch('/:id', requireRole('manager'), async (req, res) => {
  const scheduleId = id(req.params.id);
  const [cur] = await q('SELECT * FROM lesson_schedules WHERE id=?', [scheduleId]);
  if (!cur) throw notFound('Розклад не знайдено');
  const { teacherId, studentIds } = await parsePeople(req.body ?? {}, scheduleId, cur);
  await tx(async (t) => {
    const future = await t(
      `SELECT starts_at, ends_at FROM lesson_sessions WHERE schedule_id=? AND status='scheduled' AND starts_at > NOW()`,
      [scheduleId]
    );
    await assertNoConflicts(
      { teacherId, studentIds, slots: future.map((s) => ({ start: s.starts_at, end: s.ends_at })), excludeScheduleId: scheduleId },
      t
    );
    await t('UPDATE lesson_schedules SET teacher_id=? WHERE id=?', [teacherId, scheduleId]);
    await saveRoster(t, scheduleId, studentIds);
  });
  const [row] = await withRoster(await q(`${PLACEMENT_SELECT} WHERE sc.id=?`, [scheduleId]));
  res.json(row);
});

// Минулі заняття лишаються; майбутні зникають із календаря.
schedulesRouter.delete('/:id', requireRole('manager'), async (req, res) => {
  const scheduleId = id(req.params.id);
  const [s] = await q('SELECT id FROM lesson_schedules WHERE id=?', [scheduleId]);
  if (!s) throw notFound();
  await tx(async (t) => {
    await t('UPDATE lesson_schedules SET is_active=0, end_date=CURDATE() WHERE id=?', [scheduleId]);
    await removeFutureSessions('schedule_id=?', [scheduleId], t);
  });
  res.json({ ok: true });
});
