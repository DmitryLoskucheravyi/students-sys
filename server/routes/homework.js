import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { HttpError, bad, conflict, dateTime, forbidden, id, int, notFound, nowStr, str } from '../lib.js';
import { MAX_FILE_MB, UPLOAD_DIR, openFile, persistFile, removeFile } from '../storage.js';

export const homeworkRouter = Router();
export const filesRouter = Router();
homeworkRouter.use(requireAuth);
filesRouter.use(requireAuth);

const MAX_FILE = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES = 40;
const BLOCKED_EXT = new Set(['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.vbs', '.lnk', '.reg', '.dll', '.hta']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    // Назва на диску випадкова: оригінальна зберігається лише в БД.
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.bin`),
  }),
  limits: { fileSize: MAX_FILE, files: MAX_FILES, fields: 5 },
  defParamCharset: 'utf8',
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.has(ext)) return cb(bad(`Файли ${ext} не приймаємо`));
    if (file.fieldname === 'archive' && ext !== '.zip') return cb(bad('Папку завантажте як .zip'));
    if (file.fieldname === 'screenshots' && !IMAGE_EXT.has(ext)) {
      return cb(bad('Скріни: PNG, JPG, WEBP або GIF'));
    }
    cb(null, true);
  },
}).fields([
  { name: 'files', maxCount: MAX_FILES },
  { name: 'archive', maxCount: 10 },
  { name: 'screenshots', maxCount: MAX_FILES },
]);

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(bad(`Файл завеликий: максимум ${MAX_FILE_MB} МБ`));
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(bad(`Забагато файлів: максимум ${MAX_FILES}`));
      }
      return next(bad('Не вдалося завантажити файл'));
    }
    next(err);
  });
}

const allFiles = (req) => Object.values(req.files ?? {}).flat();
const removeTemp = (files) => Promise.all(files.map((f) => unlink(f.path).catch(() => {})));

async function readHead(filePath, n = 12) {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fh.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fh.close();
  }
}
const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b && [3, 5, 7].includes(b[2]);
function imageMime(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** Перевіряє вміст, а не лише розширення, і повертає рядки для БД. */
async function inspectFiles(req) {
  const rows = [];
  for (const f of req.files?.archive ?? []) {
    if (!isZip(await readHead(f.path))) throw bad(`«${f.originalname}» не є ZIP-архівом`);
    rows.push({ kind: 'archive', file: f, mime: 'application/zip' });
  }
  for (const f of req.files?.screenshots ?? []) {
    const mime = imageMime(await readHead(f.path));
    if (!mime) throw bad(`«${f.originalname}» не є зображенням`);
    rows.push({ kind: 'screenshot', file: f, mime });
  }
  for (const f of req.files?.files ?? []) {
    rows.push({ kind: 'file', file: f, mime: f.mimetype });
  }
  return rows;
}

const HW_SELECT = `
  SELECT h.id, h.lesson_id, h.session_id, h.title, h.description, h.due_at, h.created_at,
         l.title AS lesson_title, l.teacher_id, u.name AS teacher_name, c.title AS course_title
    FROM homework h
    JOIN lessons l ON l.id = h.lesson_id
    JOIN users u ON u.id = l.teacher_id
    LEFT JOIN courses c ON c.id = l.course_id`;

async function loadHomework(homeworkId) {
  const [h] = await q(`${HW_SELECT} WHERE h.id=?`, [homeworkId]);
  if (!h) throw notFound('Завдання не знайдено');
  return h;
}
async function isStudentOf(lessonId, studentId) {
  const [hit] = await q('SELECT 1 FROM lesson_students WHERE lesson_id=? AND student_id=?', [lessonId, studentId]);
  return Boolean(hit);
}
function assertStaff(user, hw) {
  if (user.role === 'manager') return;
  if (user.role === 'teacher' && hw.teacher_id === user.id) return;
  throw forbidden();
}
async function filesOf(submissionIds) {
  if (!submissionIds.length) return [];
  return q(
    `SELECT id, submission_id, kind, original_name, mime, size, created_at
       FROM submission_files WHERE submission_id IN (?) ORDER BY kind, id`,
    [submissionIds]
  );
}

homeworkRouter.get('/', async (req, res) => {
  const { role, id: me } = req.user;
  if (role === 'student') {
    const rows = await q(
      `${HW_SELECT}
       JOIN lesson_students ls ON ls.lesson_id = h.lesson_id AND ls.student_id = ?
       ORDER BY h.due_at DESC`,
      [me]
    );
    const subs = await q(
      'SELECT homework_id, status, grade, submitted_at FROM submissions WHERE student_id=?',
      [me]
    );
    return res.json(
      rows.map((h) => {
        const s = subs.find((x) => x.homework_id === h.id);
        return { ...h, my_status: s?.status ?? 'todo', my_grade: s?.grade ?? null };
      })
    );
  }
  const rows = await q(
    `SELECT t.*,
        (SELECT COUNT(*) FROM lesson_students ls WHERE ls.lesson_id = t.lesson_id) AS students_count,
        (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = t.id) AS submitted_count,
        (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = t.id AND s.status='submitted') AS to_review
       FROM (${HW_SELECT} ${role === 'teacher' ? 'WHERE l.teacher_id = ?' : ''}) t
      ORDER BY to_review DESC, t.due_at DESC`,
    role === 'teacher' ? [me] : []
  );
  res.json(rows);
});

homeworkRouter.post('/', requireRole('manager', 'teacher'), async (req, res) => {
  const b = req.body ?? {};
  const lessonId = id(b.lesson_id, 'Урок');
  const [lesson] = await q('SELECT teacher_id FROM lessons WHERE id=?', [lessonId]);
  if (!lesson) throw bad('Урок не знайдено');
  if (req.user.role === 'teacher' && lesson.teacher_id !== req.user.id) throw forbidden();
  let sessionId = null;
  if (b.session_id) {
    sessionId = id(b.session_id, 'Заняття');
    const [s] = await q('SELECT id FROM lesson_sessions WHERE id=? AND lesson_id=?', [sessionId, lessonId]);
    if (!s) throw bad('Заняття не належить цьому уроку');
  }
  const r = await q('INSERT INTO homework SET ?', [{
    lesson_id: lessonId,
    session_id: sessionId,
    title: str(b.title, 'Назва', { max: 160 }),
    description: str(b.description, 'Опис', { max: 5000, required: false }),
    due_at: dateTime(b.due_at, 'Здати до'),
    created_by: req.user.id,
  }]);
  res.status(201).json({ id: r.insertId });
});

homeworkRouter.get('/:id', async (req, res) => {
  const hw = await loadHomework(id(req.params.id));
  const { role, id: me } = req.user;
  if (role === 'student') {
    if (!(await isStudentOf(hw.lesson_id, me))) throw forbidden();
    const [submission] = await q('SELECT * FROM submissions WHERE homework_id=? AND student_id=?', [hw.id, me]);
    const files = submission ? await filesOf([submission.id]) : [];
    return res.json({ ...hw, submission: submission ? { ...submission, files } : null });
  }
  assertStaff(req.user, hw);
  const students = await q(
    `SELECT u.id, u.name FROM lesson_students ls JOIN users u ON u.id = ls.student_id
      WHERE ls.lesson_id=? ORDER BY u.name`,
    [hw.lesson_id]
  );
  const subs = await q(
    `SELECT s.*, u.name AS student_name FROM submissions s JOIN users u ON u.id = s.student_id WHERE s.homework_id=?`,
    [hw.id]
  );
  const files = await filesOf(subs.map((s) => s.id));
  // Учень міг вибути з групи, але його робота лишається видимою.
  const merged = [
    ...students.map((st) => ({ student_id: st.id, student_name: st.name, submission: subs.find((s) => s.student_id === st.id) ?? null })),
    ...subs
      .filter((s) => !students.some((st) => st.id === s.student_id))
      .map((s) => ({ student_id: s.student_id, student_name: s.student_name, submission: s })),
  ].map((row) => ({
    ...row,
    submission: row.submission ? { ...row.submission, files: files.filter((f) => f.submission_id === row.submission.id) } : null,
  }));
  res.json({ ...hw, students: merged });
});

homeworkRouter.patch('/:id', requireRole('manager', 'teacher'), async (req, res) => {
  const hw = await loadHomework(id(req.params.id));
  assertStaff(req.user, hw);
  const b = req.body ?? {};
  await q('UPDATE homework SET title=?, description=?, due_at=? WHERE id=?', [
    str(b.title, 'Назва', { max: 160 }),
    str(b.description, 'Опис', { max: 5000, required: false }),
    dateTime(b.due_at, 'Здати до'),
    hw.id,
  ]);
  res.json({ ok: true });
});

homeworkRouter.delete('/:id', requireRole('manager', 'teacher'), async (req, res) => {
  const hw = await loadHomework(id(req.params.id));
  assertStaff(req.user, hw);
  const stored = await q(
    `SELECT f.stored_name FROM submission_files f JOIN submissions s ON s.id = f.submission_id WHERE s.homework_id=?`,
    [hw.id]
  );
  await q('DELETE FROM homework WHERE id=?', [hw.id]);
  await Promise.all(stored.map((f) => removeFile(f.stored_name)));
  res.json({ ok: true });
});

/* Здача: файли, ZIP-папка, скріни — в одному запиті */
homeworkRouter.post('/:id/submission', requireRole('student'), handleUpload, async (req, res) => {
  const uploaded = allFiles(req);
  const persisted = [];
  try {
    const hw = await loadHomework(id(req.params.id));
    if (!(await isStudentOf(hw.lesson_id, req.user.id))) throw forbidden();
    const rows = await inspectFiles(req);
    const comment = str(req.body?.comment, 'Коментар', { max: 3000, required: false });

    // Ранні перевірки до копіювання файлів у сховище: відмова не має витрачати трафік.
    const [existing] = await q('SELECT id, status FROM submissions WHERE homework_id=? AND student_id=?', [hw.id, req.user.id]);
    if (existing?.status === 'accepted') throw conflict('Роботу вже прийнято');
    if (!existing && !rows.length) throw bad('Додайте хоча б один файл');

    for (const { file } of rows) {
      await persistFile(file.filename);
      persisted.push(file.filename);
    }

    await tx(async (t) => {
      const [cur] = await t(
        'SELECT * FROM submissions WHERE homework_id=? AND student_id=? FOR UPDATE',
        [hw.id, req.user.id]
      );
      if (cur?.status === 'accepted') throw conflict('Роботу вже прийнято');
      const [{ n }] = cur
        ? await t('SELECT COUNT(*) n FROM submission_files WHERE submission_id=?', [cur.id])
        : [{ n: 0 }];
      if (!rows.length && !n) throw bad('Додайте хоча б один файл');
      if (n + rows.length > MAX_FILES) throw bad(`Забагато файлів: максимум ${MAX_FILES}`);

      let submissionId = cur?.id;
      if (cur) {
        await t(
          `UPDATE submissions SET comment=?, status='submitted', submitted_at=? WHERE id=?`,
          [comment ?? cur.comment, nowStr(), cur.id]
        );
      } else {
        const r = await t('INSERT INTO submissions SET ?', [{
          homework_id: hw.id, student_id: req.user.id, comment, submitted_at: nowStr(),
        }]);
        submissionId = r.insertId;
      }
      for (const { kind, file, mime } of rows) {
        await t('INSERT INTO submission_files SET ?', [{
          submission_id: submissionId,
          kind,
          original_name: file.originalname.slice(0, 255),
          stored_name: file.filename,
          mime,
          size: file.size,
        }]);
      }
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    await removeTemp(uploaded);
    await Promise.all(persisted.map(removeFile));
    throw e;
  }
});

filesRouter.delete('/:id', requireRole('student'), async (req, res) => {
  const fileId = id(req.params.id);
  const [f] = await q(
    `SELECT f.id, f.stored_name, f.submission_id, s.student_id, s.status FROM submission_files f
       JOIN submissions s ON s.id = f.submission_id WHERE f.id=?`,
    [fileId]
  );
  if (!f || f.student_id !== req.user.id) throw notFound('Файл не знайдено');
  if (f.status === 'accepted') throw conflict('Роботу вже прийнято');
  if (f.status === 'submitted') {
    const [{ n }] = await q('SELECT COUNT(*) n FROM submission_files WHERE submission_id=?', [f.submission_id]);
    if (n <= 1) throw conflict('Це останній файл роботи. Спершу додайте новий.');
  }
  await q('DELETE FROM submission_files WHERE id=?', [fileId]);
  await removeFile(f.stored_name);
  res.json({ ok: true });
});

homeworkRouter.post('/submissions/:id/review', requireRole('manager', 'teacher'), async (req, res) => {
  const subId = id(req.params.id);
  const [s] = await q('SELECT homework_id FROM submissions WHERE id=?', [subId]);
  if (!s) throw notFound('Роботу не знайдено');
  assertStaff(req.user, await loadHomework(s.homework_id));
  const status = req.body?.status;
  if (!['accepted', 'returned'].includes(status)) throw bad('Оберіть: прийняти або повернути');
  const grade = req.body?.grade == null || req.body.grade === '' ? null : int(req.body.grade, 'Оцінка', { min: 1, max: 12 });
  const feedback = str(req.body?.feedback, 'Коментар', { max: 3000, required: false });
  if (status === 'returned' && !feedback) throw bad('Напишіть, що виправити');
  await q(
    'UPDATE submissions SET status=?, grade=?, feedback=?, reviewed_at=?, reviewed_by=? WHERE id=?',
    [status, status === 'accepted' ? grade : null, feedback, nowStr(), req.user.id, subId]
  );
  res.json({ ok: true });
});

/* Видача файлів: лише автору, вчителю уроку та менеджеру */
filesRouter.get('/:id', async (req, res) => {
  const fileId = id(req.params.id);
  const [f] = await q(
    `SELECT f.*, s.student_id, l.teacher_id
       FROM submission_files f
       JOIN submissions s ON s.id = f.submission_id
       JOIN homework h ON h.id = s.homework_id
       JOIN lessons l ON l.id = h.lesson_id
      WHERE f.id=?`,
    [fileId]
  );
  const { role, id: me } = req.user;
  const allowed = f && (role === 'manager' || (role === 'teacher' && f.teacher_id === me) || (role === 'student' && f.student_id === me));
  if (!allowed) throw new HttpError(404, 'Файл не знайдено');

  const missing = () => {
    if (res.headersSent) return res.destroy();
    for (const header of ['Content-Length', 'Content-Disposition', 'Content-Type', 'Cache-Control']) res.removeHeader(header);
    res.status(404).json({ error: 'Файл не знайдено' });
  };
  let stream;
  try {
    stream = await openFile(f.stored_name);
  } catch (e) {
    console.error(`Файл ${f.id}: ${e.name}`);
    return missing();
  }
  // Вбудовано показуємо лише перевірені зображення. Решта завжди завантажується.
  const inline = f.kind === 'screenshot' && req.query.download === undefined;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', inline ? f.mime : 'application/octet-stream');
  res.setHeader('Content-Length', f.size);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Disposition', contentDisposition(f.original_name, inline));
  stream.on('error', missing);
  stream.pipe(res);
});

function contentDisposition(name, inline) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
