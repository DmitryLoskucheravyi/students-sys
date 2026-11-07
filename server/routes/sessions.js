import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { addDays, addMinutes, bad, conflict, dateTime, forbidden, id, idList, isoDate, notFound, nowStr, str, today } from '../lib.js';
import { assertNoConflicts, ensureSessions, rosterOf } from '../schedule.js';

export const sessionsRouter = Router();
export const requestsRouter = Router();
sessionsRouter.use(requireAuth);
requestsRouter.use(requireRole('manager', 'teacher'));

const SESSION_SELECT = `
  SELECT se.id, se.lesson_id, se.schedule_id, se.starts_at, se.ends_at, se.original_starts_at, se.status, se.cancel_reason,
         l.title, COALESCE(se.location, rm.url, l.location) AS location, se.location AS own_location,
         CASE WHEN se.location IS NULL THEN rm.service END AS room_service,
         l.note, sc.teacher_id, l.course_id,
         c.title AS course_title, u.name AS teacher_name, sc.kind
    FROM lesson_sessions se
    JOIN lessons l ON l.id = se.lesson_id
    JOIN lesson_schedules sc ON sc.id = se.schedule_id
    LEFT JOIN teacher_rooms rm ON rm.id = sc.room_id
    LEFT JOIN users u ON u.id = sc.teacher_id
    LEFT JOIN courses c ON c.id = l.course_id`;

// Учень бачить заняття своєї постановки, а також ті, на яких уже був (навіть якщо його потім прибрали).
const STUDENT_SCOPE = `(EXISTS (SELECT 1 FROM schedule_students x WHERE x.schedule_id = se.schedule_id AND x.student_id = ?)
                     OR EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = se.id AND a.student_id = ?))`;

function scope(user) {
  if (user.role === 'teacher') return { sql: 'sc.teacher_id = ?', params: [user.id] };
  if (user.role === 'student') return { sql: STUDENT_SCOPE, params: [user.id, user.id] };
  return { sql: '1=1', params: [] };
}

/** Додає учасників: персонал бачить склад, учень — лише свій запис. */
async function attachPeople(rows, user) {
  if (!rows.length) return rows;
  const sessionIds = rows.map((r) => r.id);
  const scheduleIds = [...new Set(rows.map((r) => r.schedule_id))];
  const attendance = await q(
    `SELECT a.session_id, a.student_id, a.attended, a.price_charged, u.name
       FROM attendance a JOIN users u ON u.id = a.student_id WHERE a.session_id IN (?)`,
    [sessionIds]
  );
  if (user.role === 'student') {
    return rows.map((r) => {
      const mine = attendance.find((a) => a.session_id === r.id && a.student_id === user.id);
      return { ...r, my_attended: mine ? mine.attended : null, my_price: mine?.price_charged ?? null };
    });
  }
  const roster = await q(
    `SELECT ss.schedule_id, u.id, u.name FROM schedule_students ss JOIN users u ON u.id = ss.student_id
      WHERE ss.schedule_id IN (?) ORDER BY u.name`,
    [scheduleIds]
  );
  return rows.map((r) => ({
    ...r,
    students:
      r.status === 'completed'
        ? attendance
            .filter((a) => a.session_id === r.id)
            .map((a) => ({ id: a.student_id, name: a.name, attended: a.attended, price_charged: a.price_charged }))
        : roster.filter((s) => s.schedule_id === r.schedule_id).map((s) => ({ id: s.id, name: s.name })),
  }));
}

sessionsRouter.get('/', async (req, res) => {
  const from = isoDate(req.query.from, 'Від');
  const to = isoDate(req.query.to, 'До');
  if (to < from || to > addDays(from, 92)) throw bad('Некоректний проміжок дат');
  await ensureSessions(to);

  const s = scope(req.user);
  const where = [`se.starts_at >= ?`, `se.starts_at < ?`, s.sql];
  const params = [`${from} 00:00:00`, `${addDays(to, 1)} 00:00:00`, ...s.params];
  if (req.user.role === 'manager') {
    if (req.query.teacher_id) {
      where.push('sc.teacher_id = ?');
      params.push(id(req.query.teacher_id));
    }
    if (req.query.student_id) {
      where.push(STUDENT_SCOPE);
      const sid = id(req.query.student_id);
      params.push(sid, sid);
    }
  }
  const rows = await q(`${SESSION_SELECT} WHERE ${where.join(' AND ')} ORDER BY se.starts_at`, params);
  res.json(await attachPeople(rows, req.user));
});

// Короткий зріз для учня: наступне заняття, залишок уроків, домашні до здачі.
sessionsRouter.get('/summary', requireRole('student'), async (req, res) => {
  const me = req.user.id;
  await ensureSessions(addDays(today(), 30));
  const [next] = await q(
    `${SESSION_SELECT} WHERE ${STUDENT_SCOPE} AND se.status='scheduled' AND se.starts_at > NOW() ORDER BY se.starts_at LIMIT 1`,
    [me, me]
  );
  const [{ left }] = await q(
    `SELECT COALESCE(SUM(lessons_total - lessons_used), 0) AS \`left\` FROM subscriptions
      WHERE student_id=? AND status='active' AND expires_on >= CURDATE() AND starts_on <= CURDATE()`,
    [me]
  );
  const [{ todo }] = await q(
    `SELECT COUNT(*) AS todo FROM homework h
       JOIN schedule_students ss ON ss.schedule_id = h.schedule_id AND ss.student_id = ?
       LEFT JOIN submissions s ON s.homework_id = h.id AND s.student_id = ?
      WHERE s.id IS NULL OR s.status = 'returned'`,
    [me, me]
  );
  res.json({ next: next ?? null, lessons_left: left, homework_todo: todo });
});

async function loadSession(sessionId, conn = q) {
  const [s] = await conn(
    `SELECT se.*, sc.teacher_id, l.duration_min, l.title, l.is_active AS lesson_active
       FROM lesson_sessions se
       JOIN lessons l ON l.id = se.lesson_id
       JOIN lesson_schedules sc ON sc.id = se.schedule_id
      WHERE se.id=?`,
    [sessionId]
  );
  if (!s) throw notFound('Заняття не знайдено');
  return s;
}
function assertStaffOf(user, session) {
  if (user.role === 'manager') return;
  if (user.role === 'teacher' && session.teacher_id === user.id) return;
  throw forbidden('Це заняття веде інший вчитель');
}

sessionsRouter.get('/:id', async (req, res) => {
  const sessionId = id(req.params.id);
  const s = scope(req.user);
  const rows = await q(`${SESSION_SELECT} WHERE se.id=? AND ${s.sql}`, [sessionId, ...s.params]);
  if (!rows.length) throw notFound('Заняття не знайдено');
  const [session] = await attachPeople(rows, req.user);
  session.homework = await q(
    'SELECT id, title, due_at FROM homework WHERE session_id=? ORDER BY due_at',
    [sessionId]
  );
  // Кабінети вчителя заняття: підказки, коли персонал міняє місце. Учневі не потрібні.
  session.teacher_rooms = req.user.role === 'student' || !session.teacher_id
    ? []
    : (await q('SELECT id, service, url, is_default FROM teacher_rooms WHERE teacher_id=? ORDER BY is_default DESC, position, id', [session.teacher_id]))
      .map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
  session.requests =
    req.user.role === 'student'
      ? await q(
          `SELECT id, kind, status, proposed_starts_at FROM session_requests
            WHERE session_id=? AND student_id=? ORDER BY id DESC`,
          [sessionId, req.user.id]
        )
      : await q(
          `SELECT r.id, r.kind, r.status, r.reason, r.proposed_starts_at, u.name AS student_name
             FROM session_requests r JOIN users u ON u.id = r.student_id
            WHERE r.session_id=? AND r.status='pending' ORDER BY r.id`,
          [sessionId]
        );
  // Для проведення: з яких абонементів можна списати урок кожному учневі.
  if (req.user.role !== 'student' && session.status === 'scheduled' && session.students.length) {
    const date = session.starts_at.slice(0, 10);
    const subs = await chargeable(session.students.map((st) => st.id), date);
    session.charge_options = Object.fromEntries(session.students.map((st) => [st.id, subs.filter((x) => x.student_id === st.id)]));
  }
  res.json(session);
});

/**
 * Абонементи, з яких можна списати урок за заняття в `date`: чинні, з вільними уроками, не прострочені на ту дату.
 * Спершу ті, що діють на дату заняття; далі ті, що починаються пізніше (заняття вносять заднім числом).
 */
async function chargeable(studentIds, date, conn = q, lock = false) {
  if (!studentIds.length) return [];
  const rows = await conn(
    `SELECT id, student_id, name, price_per_lesson, starts_on, expires_on, lessons_total - lessons_used AS lessons_left,
            (starts_on <= ?) AS covers
       FROM subscriptions
      WHERE student_id IN (?) AND status = 'active' AND lessons_used < lessons_total AND expires_on >= ?
      ORDER BY covers DESC, expires_on, id ${lock ? 'FOR UPDATE' : ''}`,
    [date, studentIds, date]
  );
  return rows.map((r) => ({ ...r, covers: Boolean(r.covers) }));
}

/* Дії: кожна окремою функцією, бо їх викликають і вчитель, і схвалення запиту учня */
async function applyCancel(session, reason, t) {
  if (session.status !== 'scheduled') throw conflict('Скасувати можна лише заплановане заняття');
  await t(`UPDATE lesson_sessions SET status='cancelled', cancel_reason=? WHERE id=?`, [reason, session.id]);
}

async function applyReschedule(session, startsAt, t) {
  if (session.status !== 'scheduled') throw conflict('Перенести можна лише заплановане заняття');
  if (startsAt <= nowStr()) throw bad('Оберіть час у майбутньому');
  const endsAt = addMinutes(startsAt, session.duration_min);
  await assertNoConflicts(
    {
      teacherId: session.teacher_id,
      studentIds: await rosterOf(session.schedule_id, t),
      slots: [{ start: startsAt, end: endsAt }],
      excludeSessionId: session.id,
    },
    t
  );
  await t('UPDATE lesson_sessions SET starts_at=?, ends_at=? WHERE id=?', [startsAt, endsAt, session.id]);
}

async function closePendingRequests(sessionId, exceptId, userId, t) {
  await t(
    `UPDATE session_requests SET status='rejected', resolved_by=?, resolved_at=NOW()
      WHERE session_id=? AND status='pending' AND id<>?`,
    [userId, sessionId, exceptId]
  );
}

sessionsRouter.post('/:id/cancel', requireRole('manager', 'teacher'), async (req, res) => {
  const sessionId = id(req.params.id);
  const reason = str(req.body?.reason, 'Причина', { max: 300, required: false });
  await tx(async (t) => {
    const s = await loadSession(sessionId, t);
    assertStaffOf(req.user, s);
    await applyCancel(s, reason, t);
    await closePendingRequests(sessionId, 0, req.user.id, t);
  });
  res.json({ ok: true });
});

sessionsRouter.post('/:id/reschedule', requireRole('manager', 'teacher'), async (req, res) => {
  const sessionId = id(req.params.id);
  const startsAt = dateTime(req.body?.starts_at, 'Новий час');
  await tx(async (t) => {
    const s = await loadSession(sessionId, t);
    assertStaffOf(req.user, s);
    await applyReschedule(s, startsAt, t);
    await closePendingRequests(sessionId, 0, req.user.id, t);
  });
  res.json({ ok: true });
});

/**
 * Місце чи посилання лише цього заняття: інші заняття й сам урок не змінюються.
 * Порожнє значення повертає місце з уроку.
 */
sessionsRouter.patch('/:id/location', requireRole('manager', 'teacher'), async (req, res) => {
  const sessionId = id(req.params.id);
  const s = await loadSession(sessionId);
  assertStaffOf(req.user, s);
  const location = str(req.body?.location, 'Місце', { max: 200, required: false });
  await q('UPDATE lesson_sessions SET location=? WHERE id=?', [location, sessionId]);
  res.json({ ok: true });
});

/** Явний вибір абонемента: { [id учня]: id абонемента або null, тобто без списання }. */
function parseCharges(raw) {
  if (raw == null) return new Map();
  if (typeof raw !== 'object' || Array.isArray(raw)) throw bad('«Абонементи»: некоректне значення');
  return new Map(Object.entries(raw).map(([studentId, subId]) => [id(studentId, 'Учень'), subId == null || subId === 0 ? null : id(subId, 'Абонемент')]));
}

/**
 * Проводить заняття і списує урок із абонементів присутніх за їхньою поточною ціною.
 * Без явного вибору списується абонемент, що діє на дату заняття. Явно можна обрати й той,
 * що почнеться пізніше: так вносять заняття заднім числом.
 */
sessionsRouter.post('/:id/complete', requireRole('manager', 'teacher'), async (req, res) => {
  const sessionId = id(req.params.id);
  const attended = new Set(idList(req.body?.attended_ids ?? [], 'Присутні'));
  const charges = parseCharges(req.body?.charges);
  const warnings = [];
  await tx(async (t) => {
    const [s] = await t(
      `SELECT se.*, sc.teacher_id FROM lesson_sessions se JOIN lesson_schedules sc ON sc.id = se.schedule_id
        WHERE se.id=? FOR UPDATE`,
      [sessionId]
    );
    if (!s) throw notFound('Заняття не знайдено');
    assertStaffOf(req.user, s);
    if (s.status !== 'scheduled') throw conflict('Заняття вже закрите');
    if (s.starts_at > nowStr()) throw bad('Заняття ще не почалося');

    const sessionDate = s.starts_at.slice(0, 10);
    const roster = await t(
      `SELECT u.id, u.name FROM schedule_students ss JOIN users u ON u.id = ss.student_id WHERE ss.schedule_id=?`,
      [s.schedule_id]
    );
    for (const student of roster) {
      const present = attended.has(student.id);
      let subId = null;
      let price = null;
      if (present) {
        const options = await chargeable([student.id], sessionDate, t, true);
        let sub = null;
        if (charges.has(student.id)) {
          const chosen = charges.get(student.id);
          if (chosen !== null) {
            sub = options.find((o) => o.id === chosen);
            if (!sub) throw bad(`Абонемент для ${student.name} не підходить: він закінчився, використаний або чужий`);
          }
        } else {
          sub = options.find((o) => o.covers) ?? null;
          if (!sub) warnings.push(student.name);
        }
        if (sub) {
          subId = sub.id;
          price = sub.price_per_lesson;
          await t('UPDATE subscriptions SET lessons_used = lessons_used + 1 WHERE id=?', [sub.id]);
        }
      }
      await t(
        'INSERT INTO attendance (session_id, student_id, attended, subscription_id, price_charged) VALUES (?,?,?,?,?)',
        [sessionId, student.id, present ? 1 : 0, subId, price]
      );
    }
    await t(`UPDATE lesson_sessions SET status='completed', completed_at=NOW() WHERE id=?`, [sessionId]);
    // Заняття відбулося: запит на його скасування чи перенесення вже нічого не змінить.
    await closePendingRequests(sessionId, 0, req.user.id, t);
  });
  res.json({ ok: true, no_subscription: warnings });
});

/** Повертає заняття в заплановані: відновлює скасоване або відміняє проведення з поверненням уроків. */
sessionsRouter.post('/:id/reopen', requireRole('manager', 'teacher'), async (req, res) => {
  const sessionId = id(req.params.id);
  await tx(async (t) => {
    const [s] = await t(
      `SELECT se.*, sc.teacher_id FROM lesson_sessions se JOIN lesson_schedules sc ON sc.id = se.schedule_id
        WHERE se.id=? FOR UPDATE`,
      [sessionId]
    );
    if (!s) throw notFound('Заняття не знайдено');
    assertStaffOf(req.user, s);
    if (s.status === 'scheduled') return;
    if (s.status === 'cancelled') {
      await assertNoConflicts(
        {
          teacherId: s.teacher_id,
          studentIds: await rosterOf(s.schedule_id, t),
          slots: [{ start: s.starts_at, end: s.ends_at }],
          excludeSessionId: s.id,
        },
        t
      );
    }
    const charges = await t(
      'SELECT subscription_id FROM attendance WHERE session_id=? AND subscription_id IS NOT NULL',
      [sessionId]
    );
    for (const c of charges) {
      await t('UPDATE subscriptions SET lessons_used = GREATEST(lessons_used - 1, 0) WHERE id=?', [c.subscription_id]);
    }
    await t('DELETE FROM attendance WHERE session_id=?', [sessionId]);
    await t(
      `UPDATE lesson_sessions SET status='scheduled', cancel_reason=NULL, completed_at=NULL WHERE id=?`,
      [sessionId]
    );
  });
  res.json({ ok: true });
});

/* Запити учня: скасування чи перенесення підтверджує вчитель або менеджер */
sessionsRouter.post('/:id/requests', requireRole('student'), async (req, res) => {
  const sessionId = id(req.params.id);
  const session = await loadSession(sessionId);
  const roster = await rosterOf(session.schedule_id);
  if (!roster.includes(req.user.id)) throw forbidden();
  if (session.status !== 'scheduled' || session.starts_at <= nowStr()) {
    throw conflict('Запит можна надіслати лише для майбутнього заняття');
  }
  const kind = req.body?.kind;
  if (!['cancel', 'reschedule'].includes(kind)) throw bad('Невідомий тип запиту');
  const proposed = kind === 'reschedule' ? dateTime(req.body?.proposed_starts_at, 'Бажаний час') : null;
  if (proposed && proposed <= nowStr()) throw bad('Оберіть час у майбутньому');
  const [pending] = await q(
    `SELECT id FROM session_requests WHERE session_id=? AND student_id=? AND status='pending'`,
    [sessionId, req.user.id]
  );
  if (pending) throw conflict('Запит уже надіслано');
  await q('INSERT INTO session_requests SET ?', [{
    session_id: sessionId,
    student_id: req.user.id,
    kind,
    reason: str(req.body?.reason, 'Причина', { max: 300, required: false }),
    proposed_starts_at: proposed,
  }]);
  res.status(201).json({ ok: true });
});

requestsRouter.get('/', async (req, res) => {
  const isTeacher = req.user.role === 'teacher';
  res.json(
    await q(
      `SELECT r.id, r.kind, r.reason, r.proposed_starts_at, r.session_id, u.name AS student_name,
              se.starts_at, l.title
         FROM session_requests r
         JOIN users u ON u.id = r.student_id
         JOIN lesson_sessions se ON se.id = r.session_id
         JOIN lessons l ON l.id = se.lesson_id
         JOIN lesson_schedules sc ON sc.id = se.schedule_id
        WHERE r.status='pending' ${isTeacher ? 'AND sc.teacher_id = ?' : ''}
        ORDER BY se.starts_at`,
      isTeacher ? [req.user.id] : []
    )
  );
});

requestsRouter.post('/:id/:decision', async (req, res) => {
  const requestId = id(req.params.id);
  const { decision } = req.params;
  if (!['approve', 'reject'].includes(decision)) throw notFound();
  await tx(async (t) => {
    const [r] = await t(`SELECT * FROM session_requests WHERE id=? AND status='pending' FOR UPDATE`, [requestId]);
    if (!r) throw conflict('Запит уже розглянуто');
    const s = await loadSession(r.session_id, t);
    assertStaffOf(req.user, s);
    if (decision === 'approve') {
      if (r.kind === 'cancel') await applyCancel(s, r.reason ?? 'На прохання учня', t);
      else await applyReschedule(s, r.proposed_starts_at, t);
      await closePendingRequests(s.id, r.id, req.user.id, t);
    }
    await t(`UPDATE session_requests SET status=?, resolved_by=?, resolved_at=NOW() WHERE id=?`, [
      decision === 'approve' ? 'approved' : 'rejected', req.user.id, r.id,
    ]);
  });
  res.json({ ok: true });
});
