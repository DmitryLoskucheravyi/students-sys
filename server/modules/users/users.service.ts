import { Injectable } from '@nestjs/common';
import { type Query, type Row, q, tx } from '../../db.js';
import { bad, conflict, id, notFound, str } from '../../lib.js';
import { parseAvatar } from '../../avatars.js';
import { hashPassword, validatePassword } from '../../common/auth.js';

const FIELDS = 'id, role, name, login, phone, avatar, is_active, created_at';
const MAX_ROOMS = 10;

interface Room { id: number | null; service: string; url: string; is_default: boolean }

/** Кабінети вчителя: сервіс і посилання. Посилання лише http(s), бо його відкривають учні. */
function parseRooms(raw: unknown): Room[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) throw bad('«Кабінети»: потрібен список');
  if (raw.length > MAX_ROOMS) throw bad(`Максимум ${MAX_ROOMS} кабінетів`);
  const rooms = raw.map((r: any, i: number): Room => {
    const service = str(r?.service, `Сервіс кабінету ${i + 1}`, { max: 60 });
    const url = str(r?.url, `Посилання кабінету ${i + 1}`, { max: 300 });
    let parsed: URL | undefined;
    try { parsed = new URL(url); } catch { /* перевірка нижче */ }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) throw bad(`Кабінет ${i + 1}: посилання має починатися з https://`);
    return { id: r?.id ? id(r.id, 'Кабінет') : null, service, url, is_default: Boolean(r?.is_default) };
  });
  // Основний кабінет рівно один: якщо не позначено або позначено кілька, береться перший позначений чи перший у списку.
  const main = Math.max(0, rooms.findIndex((r) => r.is_default));
  return rooms.map((r, i) => ({ ...r, is_default: i === main }));
}

/** Замінює список: наявні кабінети оновлюються (розклад, що на них посилається, бачить нове посилання), решта додаються. */
async function saveRooms(t: Query, teacherId: number, rooms: Room[]) {
  const current: number[] = (await t('SELECT id FROM teacher_rooms WHERE teacher_id=?', [teacherId])).map((r: Row) => r.id);
  const keep = rooms.filter((r) => r.id).map((r) => r.id as number);
  if (keep.some((rid) => !current.includes(rid))) throw bad('Кабінет не належить цьому вчителю');
  const removed = current.filter((rid) => !keep.includes(rid));
  if (removed.length) await t('DELETE FROM teacher_rooms WHERE id IN (?)', [removed]);
  for (const [i, r] of rooms.entries()) {
    if (r.id) await t('UPDATE teacher_rooms SET service=?, url=?, is_default=?, position=? WHERE id=?', [r.service, r.url, r.is_default ? 1 : 0, i, r.id]);
    else await t('INSERT INTO teacher_rooms (teacher_id, service, url, is_default, position) VALUES (?,?,?,?,?)', [teacherId, r.service, r.url, r.is_default ? 1 : 0, i]);
  }
}

async function withRooms(rows: Row[]): Promise<Row[]> {
  const teachers = rows.filter((u) => u.role === 'teacher').map((u) => u.id);
  const rooms: Row[] = teachers.length
    ? await q('SELECT id, teacher_id, service, url, is_default FROM teacher_rooms WHERE teacher_id IN (?) ORDER BY position, id', [teachers])
    : [];
  return rows.map((u) => (u.role === 'teacher'
    ? { ...u, rooms: rooms.filter((r) => r.teacher_id === u.id).map(({ teacher_id: _t, is_default: d, ...r }) => ({ ...r, is_default: Boolean(d) })) }
    : u));
}

function parseLogin(v: unknown): string {
  const login = str(v, 'Логін', { max: 40 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) throw bad('Логін: латиниця, цифри, крапка, дефіс; від 3 символів');
  return login;
}
async function assertLoginFree(login: string, exceptId = 0) {
  const [hit] = await q('SELECT id FROM users WHERE login=? AND id<>?', [login, exceptId]);
  if (hit) throw conflict('Такий логін уже зайнятий');
}

async function managed(idValue: unknown): Promise<Row> {
  const [u] = await q(`SELECT ${FIELDS} FROM users WHERE id=? AND role IN ('teacher','student')`, [id(idValue)]);
  if (!u) throw notFound('Користувача не знайдено');
  return u;
}

/** Учні й вчителі школи: веде лише менеджер. */
@Injectable()
export class UsersService {
  async list(role: unknown) {
    if (role && !['teacher', 'student'].includes(role as string)) throw bad('Невідома роль');
    const rows: Row[] = await q(
      `SELECT ${FIELDS},
          (SELECT COUNT(DISTINCT sc.lesson_id) FROM schedule_students ss
             JOIN lesson_schedules sc ON sc.id = ss.schedule_id JOIN lessons l ON l.id = sc.lesson_id
            WHERE ss.student_id = users.id AND sc.is_active = 1 AND l.is_active = 1) AS lessons_as_student,
          (SELECT COUNT(DISTINCT sc.lesson_id) FROM lesson_schedules sc JOIN lessons l ON l.id = sc.lesson_id
            WHERE sc.teacher_id = users.id AND sc.is_active = 1 AND l.is_active = 1) AS lessons_as_teacher,
          (SELECT COALESCE(SUM(s.lessons_total - s.lessons_used), 0) FROM subscriptions s
            WHERE s.student_id = users.id AND s.status = 'active' AND s.expires_on >= CURDATE()) AS lessons_left
         FROM users WHERE role IN ('teacher','student') ${role ? 'AND role = ?' : ''}
        ORDER BY is_active DESC, name`,
      role ? [role] : []
    );
    return withRooms(rows);
  }

  async create(body: any) {
    const role = body?.role;
    if (!['teacher', 'student'].includes(role)) throw bad('Роль: вчитель або учень');
    const name = str(body.name, "Ім'я", { max: 120 });
    const login = parseLogin(body.login);
    const phone = str(body.phone, 'Телефон', { max: 30, required: false });
    const password = validatePassword(body.password);
    const avatar = parseAvatar(body.avatar) ?? null;
    const rooms = role === 'teacher' ? parseRooms(body.rooms) ?? [] : [];
    if (rooms.some((r) => r.id)) throw bad('Новий кабінет не може мати id');
    await assertLoginFree(login);
    const hash = await hashPassword(password);
    const userId = await tx(async (t) => {
      const r = await t('INSERT INTO users (role, name, login, password_hash, phone, avatar) VALUES (?,?,?,?,?,?)', [
        role, name, login, hash, phone, avatar,
      ]);
      await saveRooms(t, r.insertId, rooms);
      return r.insertId as number;
    });
    const [row] = await withRooms(await q(`SELECT ${FIELDS} FROM users WHERE id=?`, [userId]));
    return row;
  }

  async update(idValue: unknown, b: any) {
    const u = await managed(idValue);
    b = b ?? {};
    const name = b.name !== undefined ? str(b.name, "Ім'я", { max: 120 }) : u.name;
    const phone = b.phone !== undefined ? str(b.phone, 'Телефон', { max: 30, required: false }) : u.phone;
    const login = b.login !== undefined ? parseLogin(b.login) : u.login;
    if (login !== u.login) await assertLoginFree(login, u.id);
    const rooms = parseRooms(b.rooms);
    const avatar = parseAvatar(b.avatar);
    if (rooms !== undefined && u.role !== 'teacher') throw bad('Кабінети бувають лише у вчителя');
    await tx(async (t) => {
      await t('UPDATE users SET name=?, phone=?, login=?, avatar=? WHERE id=?', [name, phone, login, avatar === undefined ? u.avatar : avatar, u.id]);
      if (rooms !== undefined) await saveRooms(t, u.id, rooms);
    });

    if (b.is_active !== undefined) {
      const active = b.is_active ? 1 : 0;
      if (!active && u.role === 'teacher') {
        const [{ n }] = await q(
          `SELECT COUNT(*) n FROM lesson_schedules sc JOIN lessons l ON l.id = sc.lesson_id
            WHERE sc.teacher_id=? AND sc.is_active=1 AND l.is_active=1
              AND (sc.kind = 'weekly' AND (sc.end_date IS NULL OR sc.end_date >= CURDATE())
                OR EXISTS (SELECT 1 FROM lesson_sessions se WHERE se.schedule_id = sc.id AND se.status = 'scheduled' AND se.starts_at > NOW()))`,
          [u.id]
        );
        if (n) throw conflict(`Вчитель стоїть у розкладі (${n}). Спершу передайте ці заняття іншому.`);
      }
      // token_version розлогінює користувача одразу
      await q('UPDATE users SET is_active=?, token_version=token_version+1 WHERE id=?', [active, u.id]);
      await q('DELETE FROM auth_sessions WHERE user_id=?', [u.id]);
    }
    return (await withRooms([await managed(u.id)]))[0];
  }

  async resetPassword(idValue: unknown, password: unknown) {
    const u = await managed(idValue);
    const hash = await hashPassword(validatePassword(password));
    await q('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [hash, u.id]);
    await q('DELETE FROM auth_sessions WHERE user_id=?', [u.id]);
    return { ok: true };
  }
}
