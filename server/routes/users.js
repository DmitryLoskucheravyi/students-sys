import { Router } from 'express';
import { q } from '../db.js';
import { hashPassword, requireRole, validatePassword } from '../auth.js';
import { bad, conflict, id, notFound, str } from '../lib.js';

export const usersRouter = Router();
usersRouter.use(requireRole('manager'));

const FIELDS = 'id, role, name, login, phone, is_active, created_at';

usersRouter.get('/', async (req, res) => {
  const role = req.query.role;
  if (role && !['teacher', 'student'].includes(role)) throw bad('Невідома роль');
  const rows = await q(
    `SELECT ${FIELDS},
        (SELECT COUNT(*) FROM lesson_students ls JOIN lessons l ON l.id = ls.lesson_id
          WHERE ls.student_id = users.id AND l.is_active = 1) AS lessons_as_student,
        (SELECT COUNT(*) FROM lessons l WHERE l.teacher_id = users.id AND l.is_active = 1) AS lessons_as_teacher,
        (SELECT COALESCE(SUM(s.lessons_total - s.lessons_used), 0) FROM subscriptions s
          WHERE s.student_id = users.id AND s.status = 'active' AND s.expires_on >= CURDATE()) AS lessons_left
       FROM users WHERE role IN ('teacher','student') ${role ? 'AND role = ?' : ''}
      ORDER BY is_active DESC, name`,
    role ? [role] : []
  );
  res.json(rows);
});

function parseLogin(v) {
  const login = str(v, 'Логін', { max: 40 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) throw bad('Логін: латиниця, цифри, крапка, дефіс; від 3 символів');
  return login;
}
async function assertLoginFree(login, exceptId = 0) {
  const [hit] = await q('SELECT id FROM users WHERE login=? AND id<>?', [login, exceptId]);
  if (hit) throw conflict('Такий логін уже зайнятий');
}

usersRouter.post('/', async (req, res) => {
  const { role } = req.body ?? {};
  if (!['teacher', 'student'].includes(role)) throw bad('Роль: вчитель або учень');
  const name = str(req.body.name, "Ім'я", { max: 120 });
  const login = parseLogin(req.body.login);
  const phone = str(req.body.phone, 'Телефон', { max: 30, required: false });
  const password = validatePassword(req.body.password);
  await assertLoginFree(login);
  const hash = await hashPassword(password);
  const r = await q('INSERT INTO users (role, name, login, password_hash, phone) VALUES (?,?,?,?,?)', [
    role, name, login, hash, phone,
  ]);
  const [row] = await q(`SELECT ${FIELDS} FROM users WHERE id=?`, [r.insertId]);
  res.status(201).json(row);
});

async function managed(idValue) {
  const [u] = await q(`SELECT ${FIELDS} FROM users WHERE id=? AND role IN ('teacher','student')`, [id(idValue)]);
  if (!u) throw notFound('Користувача не знайдено');
  return u;
}

usersRouter.patch('/:id', async (req, res) => {
  const u = await managed(req.params.id);
  const b = req.body ?? {};
  const name = b.name !== undefined ? str(b.name, "Ім'я", { max: 120 }) : u.name;
  const phone = b.phone !== undefined ? str(b.phone, 'Телефон', { max: 30, required: false }) : u.phone;
  const login = b.login !== undefined ? parseLogin(b.login) : u.login;
  if (login !== u.login) await assertLoginFree(login, u.id);
  await q('UPDATE users SET name=?, phone=?, login=? WHERE id=?', [name, phone, login, u.id]);

  if (b.is_active !== undefined) {
    const active = b.is_active ? 1 : 0;
    if (!active && u.role === 'teacher') {
      const [{ n }] = await q('SELECT COUNT(*) n FROM lessons WHERE teacher_id=? AND is_active=1', [u.id]);
      if (n) throw conflict(`У вчителя ${n} активн. уроків. Спершу передайте їх іншому.`);
    }
    // token_version розлогінює користувача одразу
    await q('UPDATE users SET is_active=?, token_version=token_version+1 WHERE id=?', [active, u.id]);
  }
  res.json(await managed(u.id));
});

usersRouter.post('/:id/password', async (req, res) => {
  const u = await managed(req.params.id);
  const hash = await hashPassword(validatePassword(req.body?.password));
  await q('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [hash, u.id]);
  res.json({ ok: true });
});
