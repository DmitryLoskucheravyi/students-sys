import { Injectable } from '@nestjs/common';
import { type Row, q } from '../../db.js';
import { addDays, bad, isoDate, today } from '../../lib.js';

const MONTHS_BACK = 6;

/* Невелика аналітика для менеджера: гроші з абонементів і заняття за обраний проміжок */
@Injectable()
export class StatsService {
  async summary(query: any) {
    const to = query.to ? isoDate(query.to, 'До') : today();
    const from = query.from ? isoDate(query.from, 'Від') : addDays(to, -29);
    if (from > to || to > addDays(from, 400)) throw bad('Некоректний проміжок дат');
    const range = [`${from} 00:00:00`, `${addDays(to, 1)} 00:00:00`];

    const [sold] = await q(
      `SELECT COUNT(*) AS count, COALESCE(SUM(COALESCE(sold_amount, lessons_total * price_per_lesson)), 0) AS amount
         FROM subscriptions WHERE created_at >= ? AND created_at < ?`,
      range
    );
    // Відпрацьовано: списання за проведені заняття плюс ручні списання з абонементів.
    const [earned] = await q(
      `SELECT COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM(lessons), 0) AS lessons FROM (
         SELECT a.price_charged AS amount, 1 AS lessons
           FROM attendance a JOIN lesson_sessions se ON se.id = a.session_id
          WHERE a.attended = 1 AND a.price_charged IS NOT NULL AND se.starts_at >= ? AND se.starts_at < ?
         UNION ALL
         SELECT w.lessons * w.price_per_lesson, w.lessons
           FROM subscription_writeoffs w WHERE w.done_on >= ? AND w.done_on < ?
       ) x`,
      [...range, from, addDays(to, 1)]
    );
    const [sessions] = await q(
      `SELECT COALESCE(SUM(status = 'completed'), 0) AS completed,
              COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
              COALESCE(SUM(status = 'scheduled' AND starts_at <= NOW()), 0) AS unmarked,
              COALESCE(SUM(status = 'scheduled' AND starts_at > NOW()), 0) AS upcoming
         FROM lesson_sessions WHERE starts_at >= ? AND starts_at < ?`,
      range
    );
    const [attendance] = await q(
      `SELECT COALESCE(SUM(a.attended), 0) AS present, COUNT(*) AS marked
         FROM attendance a JOIN lesson_sessions se ON se.id = a.session_id
        WHERE se.starts_at >= ? AND se.starts_at < ?`,
      range
    );
    // Передплачено: уроки, за які вже заплатили, але ще не провели. Стан на сьогодні.
    const [prepaid] = await q(
      `SELECT COALESCE(SUM((lessons_total - lessons_used) * price_per_lesson), 0) AS amount,
              COALESCE(SUM(lessons_total - lessons_used), 0) AS lessons,
              COUNT(*) AS subscriptions
         FROM subscriptions WHERE status = 'active' AND expires_on >= CURDATE() AND lessons_used < lessons_total`
    );

    // Календарні місяці до місяця кінця проміжку включно, від старого до нового.
    const [toYear, toMonth] = to.split('-').map(Number);
    const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = new Date(Date.UTC(toYear, toMonth - 1 - (MONTHS_BACK - 1 - i), 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });
    const monthly: Row[] = await q(
      `SELECT m.month,
              COALESCE((SELECT SUM(COALESCE(s.sold_amount, s.lessons_total * s.price_per_lesson)) FROM subscriptions s
                         WHERE DATE_FORMAT(s.created_at, '%Y-%m') = m.month), 0) AS sold,
              COALESCE((SELECT SUM(a.price_charged) FROM attendance a JOIN lesson_sessions se ON se.id = a.session_id
                         WHERE a.attended = 1 AND DATE_FORMAT(se.starts_at, '%Y-%m') = m.month), 0)
            + COALESCE((SELECT SUM(w.lessons * w.price_per_lesson) FROM subscription_writeoffs w
                         WHERE DATE_FORMAT(w.done_on, '%Y-%m') = m.month), 0) AS earned,
              COALESCE((SELECT COUNT(*) FROM lesson_sessions se WHERE se.status = 'completed'
                         AND DATE_FORMAT(se.starts_at, '%Y-%m') = m.month), 0) AS completed,
              COALESCE((SELECT COUNT(*) FROM lesson_sessions se WHERE se.status = 'cancelled'
                         AND DATE_FORMAT(se.starts_at, '%Y-%m') = m.month), 0) AS cancelled
         FROM (${Array.from({ length: MONTHS_BACK }, () => 'SELECT ? AS month').join(' UNION ALL ')}) m
        ORDER BY m.month`,
      months
    );

    const teachers: Row[] = await q(
      `SELECT COALESCE(u.name, 'Без вчителя') AS name,
              SUM(se.status = 'completed') AS completed,
              SUM(se.status = 'cancelled') AS cancelled,
              COALESCE(SUM((SELECT SUM(a.price_charged) FROM attendance a WHERE a.session_id = se.id AND a.attended = 1)), 0) AS earned
         FROM lesson_sessions se
         JOIN lesson_schedules sc ON sc.id = se.schedule_id
         LEFT JOIN users u ON u.id = sc.teacher_id
        WHERE se.starts_at >= ? AND se.starts_at < ? AND se.status IN ('completed', 'cancelled')
        GROUP BY u.id, u.name
        ORDER BY completed DESC, name`,
      range
    );

    const num = (v: unknown) => Number(v ?? 0);
    return {
      from,
      to,
      sold: { count: num(sold.count), amount: num(sold.amount) },
      earned: { amount: num(earned.amount), lessons: num(earned.lessons) },
      sessions: { completed: num(sessions.completed), cancelled: num(sessions.cancelled), unmarked: num(sessions.unmarked), upcoming: num(sessions.upcoming) },
      attendance: { present: num(attendance.present), marked: num(attendance.marked) },
      prepaid: { amount: num(prepaid.amount), lessons: num(prepaid.lessons), subscriptions: num(prepaid.subscriptions) },
      monthly: monthly.map((m: Row) => ({ month: m.month, sold: num(m.sold), earned: num(m.earned), completed: num(m.completed), cancelled: num(m.cancelled) })),
      teachers: teachers.map((t: Row) => ({ name: t.name, completed: num(t.completed), cancelled: num(t.cancelled), earned: num(t.earned) })),
    };
  }
}
