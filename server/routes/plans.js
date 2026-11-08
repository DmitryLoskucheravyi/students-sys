import { Router } from 'express';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { addDays, bad, forbidden, id, int, isoDate, money, notFound, str, today } from '../lib.js';

export const plansRouter = Router();
export const subscriptionsRouter = Router();

/* Абонементи-шаблони */
plansRouter.use(requireRole('manager'));

plansRouter.get('/', async (_req, res) => {
  res.json(
    await q(
      `SELECT p.*, (SELECT COUNT(*) FROM subscriptions s
                     WHERE s.plan_id = p.id AND s.status='active' AND s.expires_on >= CURDATE()) AS active_count
         FROM plans p ORDER BY p.is_active DESC, p.lessons_count`
    )
  );
});

function parsePlan(b) {
  return {
    name: str(b.name, 'Назва', { max: 120 }),
    lessons_count: int(b.lessons_count, 'Кількість уроків', { min: 1, max: 500 }),
    price_per_lesson: money(b.price_per_lesson, 'Вартість заняття'),
    valid_days: int(b.valid_days, 'Термін дії', { min: 1, max: 1095 }),
  };
}

plansRouter.post('/', async (req, res) => {
  const p = parsePlan(req.body ?? {});
  const r = await q('INSERT INTO plans SET ?', [p]);
  res.status(201).json((await q('SELECT * FROM plans WHERE id=?', [r.insertId]))[0]);
});

plansRouter.patch('/:id', async (req, res) => {
  const planId = id(req.params.id);
  const [cur] = await q('SELECT * FROM plans WHERE id=?', [planId]);
  if (!cur) throw notFound();
  const b = req.body ?? {};
  const p = parsePlan({ ...cur, ...b });
  const is_active = b.is_active !== undefined ? (b.is_active ? 1 : 0) : cur.is_active;
  await q('UPDATE plans SET ? WHERE id=?', [{ ...p, is_active }, planId]);
  res.json((await q('SELECT * FROM plans WHERE id=?', [planId]))[0]);
});

/* Абонементи учнів */
subscriptionsRouter.use(requireAuth);

const SUB_SELECT = `
  SELECT s.*, u.name AS student_name,
         (s.lessons_total - s.lessons_used) AS lessons_left,
         (s.lessons_total * s.price_per_lesson) AS total_price,
         (s.expires_on < CURDATE()) AS is_expired
    FROM subscriptions s JOIN users u ON u.id = s.student_id`;

subscriptionsRouter.get('/', async (req, res) => {
  const { role, id: me } = req.user;
  if (role === 'teacher') throw forbidden();
  const studentId = role === 'student' ? me : req.query.student_id ? id(req.query.student_id) : null;
  const rows = await q(
    `${SUB_SELECT} ${studentId ? 'WHERE s.student_id = ?' : ''}
      ORDER BY (s.status='active' AND s.expires_on >= CURDATE()) DESC, s.expires_on DESC, s.id DESC`,
    studentId ? [studentId] : []
  );
  res.json(rows);
});

// Історія: проведені заняття й ручні списання разом, від нових до старих.
subscriptionsRouter.get('/:id/charges', async (req, res) => {
  const subId = id(req.params.id);
  const [sub] = await q('SELECT student_id FROM subscriptions WHERE id=?', [subId]);
  if (!sub) throw notFound();
  const { role, id: me } = req.user;
  if (role === 'teacher' || (role === 'student' && sub.student_id !== me)) throw forbidden();
  const sessions = await q(
    `SELECT a.session_id, a.price_charged, se.starts_at, l.title
       FROM attendance a
       JOIN lesson_sessions se ON se.id = a.session_id
       JOIN lessons l ON l.id = se.lesson_id
      WHERE a.subscription_id = ?`,
    [subId]
  );
  const manual = await q(
    `SELECT id, lessons, price_per_lesson, done_on, note FROM subscription_writeoffs WHERE subscription_id = ?`,
    [subId]
  );
  res.json(
    [
      ...sessions.map((s) => ({
        key: `s${s.session_id}`, kind: 'session', session_id: s.session_id, title: s.title,
        starts_at: s.starts_at, date: s.starts_at, lessons: 1, price_charged: s.price_charged,
      })),
      ...manual.map((w) => ({
        key: `w${w.id}`, kind: 'manual', writeoff_id: w.id, title: w.note || 'Списано вручну', note: w.note,
        date: `${w.done_on} 00:00:00`, lessons: w.lessons, price_charged: Math.round(w.lessons * w.price_per_lesson * 100) / 100,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date))
  );
});

/** Ручне списання: учень займався, але заняття немає в розкладі. Ціна береться з абонемента зараз. */
subscriptionsRouter.post('/:id/writeoffs', requireRole('manager'), async (req, res) => {
  const subId = id(req.params.id);
  const lessons = int(req.body?.lessons ?? 1, 'Уроків', { min: 1, max: 500 });
  const doneOn = req.body?.date ? isoDate(req.body.date, 'Дата') : today();
  const note = str(req.body?.note, 'Коментар', { max: 300, required: false });
  await tx(async (t) => {
    const [sub] = await t('SELECT * FROM subscriptions WHERE id=? FOR UPDATE', [subId]);
    if (!sub) throw notFound('Абонемент не знайдено');
    const left = sub.lessons_total - sub.lessons_used;
    if (lessons > left) throw bad(left ? `На абонементі лишилось лише ${left}` : 'На абонементі не лишилось уроків');
    await t('UPDATE subscriptions SET lessons_used = lessons_used + ? WHERE id=?', [lessons, subId]);
    await t('INSERT INTO subscription_writeoffs SET ?', [{
      subscription_id: subId, lessons, price_per_lesson: sub.price_per_lesson, done_on: doneOn, note, created_by: req.user.id,
    }]);
  });
  res.status(201).json((await q(`${SUB_SELECT} WHERE s.id=?`, [subId]))[0]);
});

// Скасування ручного списання повертає уроки на абонемент.
subscriptionsRouter.delete('/:id/writeoffs/:writeoffId', requireRole('manager'), async (req, res) => {
  const subId = id(req.params.id);
  const writeoffId = id(req.params.writeoffId);
  await tx(async (t) => {
    const [w] = await t('SELECT lessons FROM subscription_writeoffs WHERE id=? AND subscription_id=? FOR UPDATE', [writeoffId, subId]);
    if (!w) throw notFound('Списання не знайдено');
    await t('UPDATE subscriptions SET lessons_used = GREATEST(lessons_used - ?, 0) WHERE id=?', [w.lessons, subId]);
    await t('DELETE FROM subscription_writeoffs WHERE id=?', [writeoffId]);
  });
  res.json((await q(`${SUB_SELECT} WHERE s.id=?`, [subId]))[0]);
});

subscriptionsRouter.post('/', requireRole('manager'), async (req, res) => {
  const b = req.body ?? {};
  const studentId = id(b.student_id, 'Учень');
  const [student] = await q(`SELECT id FROM users WHERE id=? AND role='student' AND is_active=1`, [studentId]);
  if (!student) throw bad('Учня не знайдено');
  const [plan] = await q('SELECT * FROM plans WHERE id=? AND is_active=1', [id(b.plan_id, 'Абонемент')]);
  if (!plan) throw bad('Абонемент не знайдено');

  const starts_on = b.starts_on ? isoDate(b.starts_on, 'Початок') : today();
  const expires_on = b.expires_on ? isoDate(b.expires_on, 'Закінчення') : addDays(starts_on, plan.valid_days);
  if (expires_on < starts_on) throw bad('Закінчення раніше за початок');

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
    starts_on,
    expires_on,
    created_by: req.user.id,
  }]);
  res.status(201).json((await q(`${SUB_SELECT} WHERE s.id=?`, [r.insertId]))[0]);
});

// Нова вартість діє лише на майбутні заняття: вже списані зберігають свою ціну.
subscriptionsRouter.patch('/:id', requireRole('manager'), async (req, res) => {
  const subId = id(req.params.id);
  const [cur] = await q('SELECT * FROM subscriptions WHERE id=?', [subId]);
  if (!cur) throw notFound();
  const b = req.body ?? {};
  const patch = {};
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
  res.json((await q(`${SUB_SELECT} WHERE s.id=?`, [subId]))[0]);
});
