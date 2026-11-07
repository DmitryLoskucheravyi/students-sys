import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { addDays, addMinutes, bad, hhmm, id, idList, int, isoDate, notFound, str, today, weekdayOf } from '../lib.js';
import { assertNoConflicts, ensureSessions, removeFutureSessions } from '../schedule.js';

export const lessonsRouter = Router();
export const schedulesRouter = Router();
lessonsRouter.use(requireAuth);

const LESSON_SELECT = `
  SELECT l.*, c.title AS course_title, u.name AS teacher_name
    FROM lessons l
    LEFT JOIN courses c ON c.id = l.course_id
    LEFT JOIN users u ON u.id = l.teacher_id`;

async function withDetails(lessons) {
  if (!lessons.length) return [];
  const ids = lessons.map((l) => l.id);
  const students = await q(
    `SELECT ls.lesson_id, u.id, u.name FROM lesson_students ls JOIN users u ON u.id = ls.student_id
      WHERE ls.lesson_id IN (?) ORDER BY u.name`,
    [ids]
  );
  const schedules = await q(
    // Для одноразового беремо фактичний час заняття: його могли перенести або скасувати.
    `SELECT s.id, s.lesson_id, s.kind, s.weekday,
            TIME_FORMAT(COALESCE(TIME(se.starts_at), s.start_time), '%H:%i') AS time,
            COALESCE(DATE(se.starts_at), s.start_date) AS start_date, s.end_date
       FROM lesson_schedules s
       LEFT JOIN lesson_sessions se ON s.kind = 'once' AND se.schedule_id = s.id
      WHERE s.lesson_id IN (?) AND s.is_active = 1
        AND ((s.kind = 'weekly' AND (s.end_date IS NULL OR s.end_date >= CURDATE()))
          OR (s.kind = 'once' AND se.starts_at >= CURDATE() AND se.status <> 'cancelled'))
      ORDER BY s.kind DESC, s.weekday, start_date, time`,
    [ids]
  );
  return lessons.map((l) => ({
    ...l,
    students: students.filter((s) => s.lesson_id === l.id).map(({ id: sid, name }) => ({ id: sid, name })),
    schedules: schedules.filter((s) => s.lesson_id === l.id),
  }));
}

lessonsRouter.get('/', requireRole('manager', 'teacher'), async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  const rows = await q(
    `${LESSON_SELECT} ${isTeacher ? 'WHERE l.teacher_id = ?' : ''} ORDER BY l.is_active DESC, l.title`,
    isTeacher ? [req.user.id] : []
  );
  res.json(await withDetails(rows));
});

/**
 * Урок — окрема сутність: спершу назва, курс і тривалість, а вчителя й учнів додають пізніше.
 * Поля, яких немає в запиті, лишаються як були: форма уроку не стирає склад, і навпаки.
 */
async function parseLesson(b, lessonId = 0, cur = { student_ids: [] }) {
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const pick = (k) => (has(k) ? b[k] : cur[k]);
  const teacherId = pick('teacher_id');
  const lesson = {
    title: str(pick('title'), 'Назва', { max: 120 }),
    course_id: pick('course_id') ? id(pick('course_id'), 'Курс') : null,
    teacher_id: teacherId ? id(teacherId, 'Вчитель') : null,
    duration_min: int(pick('duration_min') ?? 60, 'Тривалість', { min: 10, max: 480 }),
    location: str(pick('location'), 'Місце', { max: 200, required: false }),
    note: str(pick('note'), 'Нотатка', { max: 500, required: false }),
  };
  const studentIds = idList(pick('student_ids') ?? [], 'Учні');
  if (lesson.teacher_id && lesson.teacher_id !== cur.teacher_id) {
    const [t] = await q(`SELECT id FROM users WHERE id=? AND role='teacher' AND is_active=1`, [lesson.teacher_id]);
    if (!t) throw bad('Вчителя не знайдено');
  }
  if (lesson.course_id) {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [lesson.course_id]);
    if (!c) throw bad('Курс не знайдено');
  }
  if (studentIds.length) {
    // Вимкнений учень, який уже є в уроці, не має заважати редагувати решту полів.
    const found = await q(
      `SELECT id FROM users u WHERE id IN (?) AND role='student' AND (is_active=1
         OR EXISTS (SELECT 1 FROM lesson_students ls WHERE ls.student_id = u.id AND ls.lesson_id = ?))`,
      [studentIds, lessonId]
    );
    if (found.length !== studentIds.length) throw bad('Деяких учнів не знайдено');
  }
  return { lesson, studentIds };
}

lessonsRouter.post('/', requireRole('manager'), async (req, res) => {
  const { lesson, studentIds } = await parseLesson(req.body ?? {});
  const lessonId = await tx(async (t) => {
    const r = await t('INSERT INTO lessons SET ?', [lesson]);
    if (studentIds.length) {
      await t('INSERT INTO lesson_students (lesson_id, student_id) VALUES ?', [studentIds.map((s) => [r.insertId, s])]);
    }
    return r.insertId;
  });
  const [row] = await withDetails(await q(`${LESSON_SELECT} WHERE l.id=?`, [lessonId]));
  res.status(201).json(row);
});

lessonsRouter.patch('/:id', requireRole('manager'), async (req, res) => {
  const lessonId = id(req.params.id);
  const [cur] = await q('SELECT * FROM lessons WHERE id=?', [lessonId]);
  if (!cur) throw notFound('Урок не знайдено');
  cur.student_ids = (await q('SELECT student_id FROM lesson_students WHERE lesson_id=?', [lessonId])).map((r) => r.student_id);
  const { lesson, studentIds } = await parseLesson(req.body ?? {}, lessonId, cur);

  await tx(async (t) => {
    // Новий склад, вчитель і тривалість поширюються на майбутні заняття — перевіряємо їх наперед.
    const future = await t(
      `SELECT id, starts_at FROM lesson_sessions WHERE lesson_id=? AND status='scheduled' AND starts_at > NOW()`,
      [lessonId]
    );
    await assertNoConflicts(
      {
        teacherId: lesson.teacher_id,
        studentIds,
        slots: future.map((s) => ({ start: s.starts_at, end: addMinutes(s.starts_at, lesson.duration_min) })),
        excludeLessonId: lessonId,
      },
      t
    );
    await t('UPDATE lessons SET ? WHERE id=?', [lesson, lessonId]);
    await t('DELETE FROM lesson_students WHERE lesson_id=?', [lessonId]);
    if (studentIds.length) {
      await t('INSERT INTO lesson_students (lesson_id, student_id) VALUES ?', [studentIds.map((s) => [lessonId, s])]);
    }
    for (const s of future) {
      await t('UPDATE lesson_sessions SET ends_at=? WHERE id=?', [addMinutes(s.starts_at, lesson.duration_min), s.id]);
    }
  });
  const [row] = await withDetails(await q(`${LESSON_SELECT} WHERE l.id=?`, [lessonId]));
  res.json(row);
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

/* Розклад: постійний або одноразовий */
schedulesRouter.use(requireRole('manager'));

const CONFLICT_HORIZON_DAYS = 182;

schedulesRouter.post('/', async (req, res) => {
  const b = req.body ?? {};
  const lessonId = id(b.lesson_id, 'Урок');
  const [lesson] = await q('SELECT * FROM lessons WHERE id=? AND is_active=1', [lessonId]);
  if (!lesson) throw bad('Урок не знайдено');
  const time = hhmm(b.time);
  const students = await q('SELECT student_id FROM lesson_students WHERE lesson_id=?', [lessonId]);
  const studentIds = students.map((s) => s.student_id);

  if (b.kind === 'once') {
    const date = isoDate(b.date);
    const start = `${date} ${time}:00`;
    const end = addMinutes(start, lesson.duration_min);
    await assertNoConflicts({ teacherId: lesson.teacher_id, studentIds, slots: [{ start, end }] });
    const sessionId = await tx(async (t) => {
      const r = await t('INSERT INTO lesson_schedules SET ?', [{
        lesson_id: lessonId, kind: 'once', start_time: time, start_date: date,
      }]);
      const s = await t(
        'INSERT INTO lesson_sessions (lesson_id, schedule_id, original_starts_at, starts_at, ends_at) VALUES (?,?,?,?,?)',
        [lessonId, r.insertId, start, start, end]
      );
      return s.insertId;
    });
    return res.status(201).json({ session_id: sessionId });
  }

  if (b.kind !== 'weekly') throw bad('Оберіть: постійно або одноразово');
  const weekdays = idList(b.weekdays ?? [], 'Дні тижня');
  if (!weekdays.length || weekdays.some((d) => d > 7)) throw bad('Оберіть дні тижня');
  const startDate = b.start_date ? isoDate(b.start_date, 'Початок') : today();
  const endDate = b.end_date ? isoDate(b.end_date, 'Кінець') : null;
  if (endDate && endDate < startDate) throw bad('Кінець раніше за початок');

  // Спершу створюємо заняття інших постійних уроків, щоб побачити всі накладки.
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
  await assertNoConflicts({ teacherId: lesson.teacher_id, studentIds, slots });

  await tx(async (t) => {
    for (const weekday of weekdays) {
      await t('INSERT INTO lesson_schedules SET ?', [{
        lesson_id: lessonId, kind: 'weekly', weekday, start_time: time, start_date: startDate, end_date: endDate,
      }]);
    }
  });
  await ensureSessions(horizon);
  res.status(201).json({ ok: true });
});

// Минулі заняття лишаються; майбутні зникають із календаря.
schedulesRouter.delete('/:id', async (req, res) => {
  const scheduleId = id(req.params.id);
  const [s] = await q('SELECT id FROM lesson_schedules WHERE id=?', [scheduleId]);
  if (!s) throw notFound();
  await tx(async (t) => {
    await t('UPDATE lesson_schedules SET is_active=0, end_date=CURDATE() WHERE id=?', [scheduleId]);
    await removeFutureSessions('schedule_id=?', [scheduleId], t);
  });
  res.json({ ok: true });
});
