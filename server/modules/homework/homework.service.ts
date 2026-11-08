import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import multer from 'multer';
import { type Query, type Row, q, tx } from '../../db.js';
import { HttpError, bad, conflict, dateTime, forbidden, id, int, notFound, nowStr, str } from '../../lib.js';
import { MAX_FILE_MB, UPLOAD_DIR, openFile, persistFile, removeFile } from '../../storage.js';
import { type Topic, courseTopics, parseTopics, saveTopics, topicsOf } from '../../topics.js';
import { HW_FOR, HW_STAFF, IN_COURSE, TEACHES, sqlInt } from '../../audience.js';
import { contentDisposition, imageMime, isZip, readHead } from '../../files.js';
import type { User } from '../../common/auth.js';

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

type UploadedFiles = Record<string, Express.Multer.File[]>;

/** Приймає файли з форми. Помилки multer стають зрозумілими повідомленнями. */
function receiveFiles(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload(req, res, (err: unknown) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return reject(bad(`Файл завеликий: максимум ${MAX_FILE_MB} МБ`));
        if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
          return reject(bad(`Забагато файлів: максимум ${MAX_FILES}`));
        }
        return reject(bad('Не вдалося завантажити файл'));
      }
      reject(err);
    });
  });
}

const allFiles = (req: Request) => Object.values((req.files as UploadedFiles | undefined) ?? {}).flat();
const removeTemp = (files: Express.Multer.File[]) => Promise.all(files.map((f) => unlink(f.path).catch(() => {})));

interface FileRow { kind: 'archive' | 'screenshot' | 'file'; file: Express.Multer.File; mime: string }

/** Перевіряє вміст, а не лише розширення, і повертає рядки для БД. */
async function inspectFiles(req: Request): Promise<FileRow[]> {
  const files = (req.files as UploadedFiles | undefined) ?? {};
  const rows: FileRow[] = [];
  for (const f of files.archive ?? []) {
    if (!isZip(await readHead(f.path))) throw bad(`«${f.originalname}» не є ZIP-архівом`);
    rows.push({ kind: 'archive', file: f, mime: 'application/zip' });
  }
  for (const f of files.screenshots ?? []) {
    const mime = imageMime(await readHead(f.path));
    if (!mime) throw bad(`«${f.originalname}» не є зображенням`);
    rows.push({ kind: 'screenshot', file: f, mime });
  }
  for (const f of files.files ?? []) {
    rows.push({ kind: 'file', file: f, mime: f.mimetype });
  }
  return rows;
}

// Домашнє до уроку бере курс і вчителя з уроку та постановки, домашнє до теми — зі своїх колонок.
const HW_SELECT = `
  SELECT h.id, h.lesson_id, h.schedule_id, h.session_id, h.title, h.description, h.due_at, h.created_at,
         h.course_id IS NOT NULL AS on_roadmap, h.teacher_id AS owner_teacher_id,
         l.title AS lesson_title, COALESCE(h.course_id, l.course_id) AS course_id,
         COALESCE(sc.teacher_id, h.teacher_id) AS teacher_id, u.name AS teacher_name, c.title AS course_title
    FROM homework h
    LEFT JOIN lessons l ON l.id = h.lesson_id
    LEFT JOIN lesson_schedules sc ON sc.id = h.schedule_id
    LEFT JOIN users u ON u.id = COALESCE(sc.teacher_id, h.teacher_id)
    LEFT JOIN courses c ON c.id = COALESCE(h.course_id, l.course_id)`;
const norm = (h: Row): Row => ({ ...h, on_roadmap: Boolean(h.on_roadmap) });

async function loadHomework(homeworkId: number): Promise<Row> {
  const [h] = await q(`${HW_SELECT} WHERE h.id=?`, [homeworkId]);
  if (!h) throw notFound('Завдання не знайдено');
  return norm(h);
}
/** Домашнє до уроку бачать учні постановки, до теми роадмапу — учні курсу. */
async function isStudentOf(hw: Row, studentId: number): Promise<boolean> {
  const [hit] = await q(`SELECT 1 FROM homework h WHERE h.id=? AND ${HW_FOR('h', sqlInt(studentId))}`, [hw.id]);
  return Boolean(hit);
}
/** Вчитель бачить лише своїх учнів на домашньому до теми, яке задав менеджер. */
const limitedView = (user: User, hw: Row) => user.role === 'teacher' && hw.on_roadmap && !hw.owner_teacher_id;

/** Кому задано домашнє, очима співробітника. */
async function rosterOf(hw: Row, user: User): Promise<Row[]> {
  if (!hw.on_roadmap) {
    return q(
      `SELECT u.id, u.name FROM schedule_students ss JOIN users u ON u.id = ss.student_id
        WHERE ss.schedule_id=? ORDER BY u.name`,
      [hw.schedule_id]
    );
  }
  const teacher = hw.owner_teacher_id ?? (user.role === 'teacher' ? user.id : null);
  return q(
    `SELECT u.id, u.name FROM users u
      WHERE u.role = 'student' AND ${IN_COURSE(sqlInt(hw.course_id), teacher == null ? 'NULL' : sqlInt(teacher), 'u.id')}
      ORDER BY u.name`
  );
}
async function canStaff(user: User, hw: Row): Promise<boolean> {
  if (user.role === 'manager') return true;
  if (user.role !== 'teacher') return false;
  const [{ ok }] = await q(
    `SELECT ${HW_STAFF('h', 'sc', sqlInt(user.id))} AS ok
       FROM homework h LEFT JOIN lesson_schedules sc ON sc.id = h.schedule_id WHERE h.id=?`,
    [hw.id]
  );
  return Boolean(ok);
}
/** Доступ співробітника; з studentId — ще й до роботи конкретного учня. */
async function assertStaff(user: User, hw: Row, studentId: number | null = null): Promise<void> {
  if (!(await canStaff(user, hw))) throw forbidden();
  if (studentId != null && limitedView(user, hw) && !(await rosterOf(hw, user)).some((s) => s.id === studentId)) throw forbidden();
}
/** Змінює й видаляє менеджер, вчитель уроку або вчитель, який сам задав домашнє до теми. */
function assertOwner(user: User, hw: Row): void {
  if (user.role === 'manager') return;
  if (user.role === 'teacher' && hw.teacher_id === user.id) return;
  throw forbidden(hw.on_roadmap ? 'Це домашнє задав менеджер: змінити його може лише він' : undefined);
}
async function filesOf(submissionIds: number[]): Promise<Row[]> {
  if (!submissionIds.length) return [];
  return q(
    `SELECT id, submission_id, kind, original_name, mime, size, created_at
       FROM submission_files WHERE submission_id IN (?) ORDER BY kind, id`,
    [submissionIds]
  );
}

/** Постановка, якій задають домашнє: напряму або через її заняття. */
async function resolvePlacement(b: any): Promise<Row> {
  let scheduleId: number | null = b.schedule_id ? id(b.schedule_id, 'Урок у розкладі') : null;
  let sessionId: number | null = null;
  if (b.session_id) {
    sessionId = id(b.session_id, 'Заняття');
    const [s] = await q('SELECT schedule_id FROM lesson_sessions WHERE id=?', [sessionId]);
    if (!s) throw bad('Заняття не знайдено');
    if (scheduleId && scheduleId !== s.schedule_id) throw bad('Заняття не належить цьому уроку');
    scheduleId = s.schedule_id;
  }
  if (!scheduleId) throw bad('Оберіть урок у розкладі');
  const [placement] = await q(
    `SELECT sc.id, sc.lesson_id, sc.teacher_id, l.course_id, c.title AS course_title
       FROM lesson_schedules sc JOIN lessons l ON l.id = sc.lesson_id
       LEFT JOIN courses c ON c.id = l.course_id WHERE sc.id=?`,
    [scheduleId]
  );
  if (!placement) throw bad('Урок у розкладі не знайдено');
  return { ...placement, sessionId };
}

async function parseHwTopics(raw: any, courseId: number | null): Promise<Topic[]> {
  if (raw?.length && !courseId) throw bad('Урок не прив’язаний до курсу, тем немає');
  return parseTopics(raw, courseId);
}
const saveHwTopics = (t: Query, homeworkId: number, topics: Topic[]) => saveTopics(t, 'homework_topics', 'homework_id', homeworkId, topics);
const hwTopicsOf = (homeworkId: number) => topicsOf('homework_topics', 'homework_id', homeworkId);

/** Куди задають домашнє: до уроку в розкладі або до тем роадмапу курсу. */
async function resolveTarget(b: any, user: User): Promise<{ row: Row; topics: Topic[] }> {
  if (b.course_id == null || b.course_id === '') {
    const placement = await resolvePlacement(b);
    if (user.role === 'teacher' && placement.teacher_id !== user.id) throw forbidden();
    const topics = await parseHwTopics(b.topics, placement.course_id);
    return { row: { lesson_id: placement.lesson_id, schedule_id: placement.id, session_id: placement.sessionId }, topics };
  }
  const courseId = id(b.course_id, 'Курс');
  const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
  if (!course) throw bad('Курс не знайдено');
  if (user.role === 'teacher') {
    const [{ ok }] = await q(`SELECT ${TEACHES(sqlInt(courseId), sqlInt(user.id))} AS ok`);
    if (!ok) throw forbidden('Цей курс веде інший вчитель');
  }
  const topics = await parseTopics(b.topics, courseId);
  if (!topics.length) throw bad('Оберіть хоча б одну тему роадмапу');
  // Вчитель задає домашнє своїм учням курсу, менеджер — усім.
  return { row: { course_id: courseId, teacher_id: user.role === 'teacher' ? user.id : null }, topics };
}

/** Домашні: постановка, здача з файлами, перевірка й оцінка. */
@Injectable()
export class HomeworkService {
  /** Що можна обрати темою: роадмап курсу уроку. Порожньо, якщо урок без курсу. */
  async topics(user: User, query: any) {
    const placement = await resolvePlacement(query);
    if (user.role === 'teacher' && placement.teacher_id !== user.id) throw forbidden();
    return {
      course_id: placement.course_id,
      course_title: placement.course_title,
      steps: placement.course_id ? await courseTopics(placement.course_id) : [],
    };
  }

  async list(user: User) {
    const { role, id: me } = user;
    if (role === 'student') {
      const rows: Row[] = await q(`${HW_SELECT} WHERE ${HW_FOR('h', sqlInt(me))} ORDER BY h.due_at DESC`);
      const subs: Row[] = await q(
        'SELECT homework_id, status, grade, submitted_at, first_submitted_at, reviewed_at, seen_at FROM submissions WHERE student_id=?',
        [me]
      );
      return rows.map((h) => {
        const s = subs.find((x) => x.homework_id === h.id);
        return {
          ...norm(h),
          my_status: s?.status ?? 'todo',
          my_grade: s?.grade ?? null,
          my_new: Boolean(s?.reviewed_at && !s.seen_at),
          my_late: Boolean(s && (s.first_submitted_at ?? s.submitted_at) > h.due_at),
        };
      });
    }
    const teacher = role === 'teacher';
    // Вчитель на домашньому менеджера до теми рахує лише своїх учнів курсу.
    const courseTeacher = teacher ? `COALESCE(t.owner_teacher_id, ${sqlInt(me)})` : 't.owner_teacher_id';
    const mine = teacher ? `AND (NOT t.on_roadmap OR ${IN_COURSE('t.course_id', courseTeacher, 's.student_id')})` : '';
    const rows: Row[] = await q(
      `SELECT t.*,
          CASE WHEN t.on_roadmap
            THEN (SELECT COUNT(*) FROM users u WHERE u.role = 'student' AND ${IN_COURSE('t.course_id', courseTeacher, 'u.id')})
            ELSE (SELECT COUNT(*) FROM schedule_students ss WHERE ss.schedule_id = t.schedule_id) END AS students_count,
          (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = t.id ${mine}) AS submitted_count,
          (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = t.id AND s.status='submitted' ${mine}) AS to_review,
          (SELECT COUNT(*) FROM submissions s WHERE s.homework_id = t.id ${mine}
              AND COALESCE(s.first_submitted_at, s.submitted_at) > t.due_at) AS late_count
         FROM (${HW_SELECT} ${teacher ? `WHERE ${HW_STAFF('h', 'sc', sqlInt(me))}` : ''}) t
        ORDER BY to_review DESC, t.due_at DESC`
    );
    return rows.map(norm);
  }

  async create(user: User, body: any) {
    const b = body ?? {};
    const { row: target, topics } = await resolveTarget(b, user);
    const row = {
      ...target,
      title: str(b.title, 'Назва', { max: 160 }),
      description: str(b.description, 'Опис', { max: 5000, required: false }),
      due_at: dateTime(b.due_at, 'Здати до'),
      created_by: user.id,
    };
    const homeworkId = await tx(async (t) => {
      const r = await t('INSERT INTO homework SET ?', [row]);
      await saveHwTopics(t, r.insertId, topics);
      return r.insertId as number;
    });
    return { id: homeworkId };
  }

  async get(user: User, idValue: unknown) {
    const hw = await loadHomework(id(idValue));
    const { role, id: me } = user;
    if (role === 'student') {
      if (!(await isStudentOf(hw, me))) throw forbidden();
      const [submission] = await q('SELECT * FROM submissions WHERE homework_id=? AND student_id=?', [hw.id, me]);
      const files = submission ? await filesOf([submission.id]) : [];
      // Учень відкрив роботу: оцінка й відгук переглянуті, сповіщення гасне.
      if (submission?.reviewed_at && !submission.seen_at) await q('UPDATE submissions SET seen_at=? WHERE id=?', [nowStr(), submission.id]);
      return { ...hw, topics: await hwTopicsOf(hw.id), submission: submission ? { ...submission, files } : null };
    }
    await assertStaff(user, hw);
    const students = await rosterOf(hw, user);
    const limited = limitedView(user, hw);
    const subs = ((await q(
      `SELECT s.*, u.name AS student_name FROM submissions s JOIN users u ON u.id = s.student_id WHERE s.homework_id=?`,
      [hw.id]
    )) as Row[]).filter((s) => !limited || students.some((st) => st.id === s.student_id));
    const files = await filesOf(subs.map((s) => s.id));
    // Учень міг вибути з групи, але його робота лишається видимою.
    const merged = [
      ...students.map((st) => ({ student_id: st.id, student_name: st.name, submission: subs.find((s) => s.student_id === st.id) ?? null })),
      ...subs
        .filter((s) => !students.some((st) => st.id === s.student_id))
        .map((s) => ({ student_id: s.student_id, student_name: s.student_name, submission: s })),
    ].map((row) => ({
      ...row,
      submission: row.submission ? { ...row.submission, files: files.filter((f) => f.submission_id === row.submission!.id) } : null,
    }));
    return { ...hw, can_edit: user.role === 'manager' || hw.teacher_id === user.id, topics: await hwTopicsOf(hw.id), students: merged };
  }

  async update(user: User, idValue: unknown, body: any) {
    const hw = await loadHomework(id(idValue));
    assertOwner(user, hw);
    const b = body ?? {};
    const fields = [
      str(b.title, 'Назва', { max: 160 }),
      str(b.description, 'Опис', { max: 5000, required: false }),
      dateTime(b.due_at, 'Здати до'),
      hw.id,
    ];
    // Теми змінюються, лише коли їх передали: старі клієнти їх не надсилають.
    const topics = b.topics === undefined ? null : await parseHwTopics(b.topics, hw.course_id);
    if (hw.on_roadmap && topics && !topics.length) throw bad('Оберіть хоча б одну тему роадмапу');
    await tx(async (t) => {
      await t('UPDATE homework SET title=?, description=?, due_at=? WHERE id=?', fields);
      if (topics) await saveHwTopics(t, hw.id, topics);
    });
    return { ok: true };
  }

  async remove(user: User, idValue: unknown) {
    const hw = await loadHomework(id(idValue));
    assertOwner(user, hw);
    const stored: Row[] = await q(
      `SELECT f.stored_name FROM submission_files f JOIN submissions s ON s.id = f.submission_id WHERE s.homework_id=?`,
      [hw.id]
    );
    await q('DELETE FROM homework WHERE id=?', [hw.id]);
    await Promise.all(stored.map((f) => removeFile(f.stored_name)));
    return { ok: true };
  }

  /** Здача: файли, ZIP-папка, скріни — в одному запиті. */
  async submit(user: User, idValue: unknown, req: Request, res: Response) {
    await receiveFiles(req, res);
    const uploaded = allFiles(req);
    const persisted: string[] = [];
    try {
      const hw = await loadHomework(id(idValue));
      if (!(await isStudentOf(hw, user.id))) throw forbidden();
      const rows = await inspectFiles(req);
      const comment = str(req.body?.comment, 'Коментар', { max: 3000, required: false });

      // Ранні перевірки до копіювання файлів у сховище: відмова не має витрачати трафік.
      const [existing] = await q('SELECT id, status FROM submissions WHERE homework_id=? AND student_id=?', [hw.id, user.id]);
      if (existing?.status === 'accepted') throw conflict('Роботу вже прийнято');
      if (!existing && !rows.length) throw bad('Додайте хоча б один файл');

      for (const { file } of rows) {
        await persistFile(file.filename);
        persisted.push(file.filename);
      }

      await tx(async (t) => {
        const [cur] = await t('SELECT * FROM submissions WHERE homework_id=? AND student_id=? FOR UPDATE', [hw.id, user.id]);
        if (cur?.status === 'accepted') throw conflict('Роботу вже прийнято');
        const [{ n }] = cur ? await t('SELECT COUNT(*) n FROM submission_files WHERE submission_id=?', [cur.id]) : [{ n: 0 }];
        if (!rows.length && !n) throw bad('Додайте хоча б один файл');
        if (n + rows.length > MAX_FILES) throw bad(`Забагато файлів: максимум ${MAX_FILES}`);

        let submissionId: number = cur?.id;
        if (cur) {
          await t(`UPDATE submissions SET comment=?, status='submitted', submitted_at=? WHERE id=?`, [comment ?? cur.comment, nowStr(), cur.id]);
        } else {
          const r = await t('INSERT INTO submissions SET ?', [{
            homework_id: hw.id, student_id: user.id, comment, submitted_at: nowStr(), first_submitted_at: nowStr(),
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
      return { ok: true };
    } catch (e) {
      await removeTemp(uploaded);
      await Promise.all(persisted.map(removeFile));
      throw e;
    }
  }

  async review(user: User, subValue: unknown, body: any) {
    const subId = id(subValue);
    const [s] = await q('SELECT homework_id, student_id FROM submissions WHERE id=?', [subId]);
    if (!s) throw notFound('Роботу не знайдено');
    await assertStaff(user, await loadHomework(s.homework_id), s.student_id);
    const status = body?.status;
    if (!['accepted', 'returned'].includes(status)) throw bad('Оберіть: прийняти або повернути');
    const grade = body?.grade == null || body.grade === '' ? null : int(body.grade, 'Оцінка', { min: 1, max: 12 });
    const feedback = str(body?.feedback, 'Коментар', { max: 3000, required: false });
    if (status === 'returned' && !feedback) throw bad('Напишіть, що виправити');
    await q(
      'UPDATE submissions SET status=?, grade=?, feedback=?, reviewed_at=?, reviewed_by=?, seen_at=NULL WHERE id=?',
      [status, status === 'accepted' ? grade : null, feedback, nowStr(), user.id, subId]
    );
    return { ok: true };
  }
}

/** Файли здач: прибирає учень, поки роботу не прийнято; бачать автор, вчитель і менеджер. */
@Injectable()
export class FilesService {
  async remove(user: User, idValue: unknown) {
    const fileId = id(idValue);
    const [f] = await q(
      `SELECT f.id, f.stored_name, f.submission_id, s.student_id, s.status FROM submission_files f
         JOIN submissions s ON s.id = f.submission_id WHERE f.id=?`,
      [fileId]
    );
    if (!f || f.student_id !== user.id) throw notFound('Файл не знайдено');
    if (f.status === 'accepted') throw conflict('Роботу вже прийнято');
    if (f.status === 'submitted') {
      const [{ n }] = await q('SELECT COUNT(*) n FROM submission_files WHERE submission_id=?', [f.submission_id]);
      if (n <= 1) throw conflict('Це останній файл роботи. Спершу додайте новий.');
    }
    await q('DELETE FROM submission_files WHERE id=?', [fileId]);
    await removeFile(f.stored_name);
    return { ok: true };
  }

  /** Видача файлу потоком. Відповідь пишеться напряму, бо файл може бути великим. */
  async send(user: User, idValue: unknown, download: boolean, res: Response) {
    const fileId = id(idValue);
    const [f] = await q(
      `SELECT f.*, s.student_id, s.homework_id FROM submission_files f
         JOIN submissions s ON s.id = f.submission_id WHERE f.id=?`,
      [fileId]
    );
    const { role, id: me } = user;
    let allowed = Boolean(f) && (role !== 'student' || f.student_id === me);
    if (allowed && role !== 'student') {
      allowed = await assertStaff(user, await loadHomework(f.homework_id), f.student_id).then(() => true, () => false);
    }
    if (!allowed) throw new HttpError(404, 'Файл не знайдено');

    const missing = () => {
      if (res.headersSent) return res.destroy();
      for (const header of ['Content-Length', 'Content-Disposition', 'Content-Type', 'Cache-Control']) res.removeHeader(header);
      res.status(404).json({ error: 'Файл не знайдено' });
    };
    let stream: NodeJS.ReadableStream;
    try {
      stream = await openFile(f.stored_name);
    } catch (e) {
      console.error(`Файл ${f.id}: ${(e as Error).name}`);
      missing();
      return;
    }
    // Вбудовано показуємо лише перевірені зображення. Решта завжди завантажується.
    const inline = f.kind === 'screenshot' && !download;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', inline ? f.mime : 'application/octet-stream');
    res.setHeader('Content-Length', f.size);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', contentDisposition(f.original_name, inline));
    stream.on('error', missing);
    stream.pipe(res);
  }
}
