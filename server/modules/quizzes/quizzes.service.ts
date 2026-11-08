import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import type { Request, Response } from 'express';
import multer from 'multer';
import { type Query, type Row, q, tx } from '../../db.js';
import { bad, conflict, dateTime, forbidden, id, notFound, nowStr, str } from '../../lib.js';
import { UPLOAD_DIR, openFile, persistFile, removeFile } from '../../storage.js';
import { parseTopics, saveTopics, topicsOf } from '../../topics.js';
import { contentDisposition, imageMime, readHead } from '../../files.js';
import { HW_FOR } from '../../audience.js';
import type { User } from '../../common/auth.js';

/*
 * Тести. Менеджер створює тест (вручну або вставляє відповідь зовнішнього ШІ, її розбирає клієнт) і відкриває його учневі окремо.
 * Вчитель теж створює тести, але вони чекають на схвалення менеджера (status = 'pending'); відхилений тест вчитель виправляє й надсилає знову.
 * Учень проходить один раз; бал рахується на сервері й зберігається в призначенні.
 */

export const MAX_QUESTIONS = 40;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;
const MAX_IMAGE_MB = 5;
const IMAGE_NAME = /^[0-9a-f-]{36}\.bin$/;

interface Option { id: number | null; text: string; correct: boolean }
interface Question { id: number | null; text: string; image: string | null; options: Option[] }

/* Розбір тесту з форми */
function parseQuiz(b: any) {
  const title = str(b?.title, 'Назва тесту', { max: 160 });
  const description = str(b?.description, 'Опис', { max: 1000, required: false });
  const raw = b?.questions;
  if (!Array.isArray(raw) || !raw.length) throw bad('Додайте хоча б одне питання');
  if (raw.length > MAX_QUESTIONS) throw bad(`Максимум ${MAX_QUESTIONS} питань`);
  const questions = raw.map((x: any, i: number): Question => {
    const n = `Питання ${i + 1}`;
    const text = str(x?.text, `${n}: текст`, { max: 500 });
    const image = x?.image ? String(x.image) : null;
    if (image && !IMAGE_NAME.test(image)) throw bad(`${n}: картинку не знайдено`);
    const opts = Array.isArray(x?.options) ? x.options : [];
    if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) throw bad(`${n}: потрібно від ${MIN_OPTIONS} до ${MAX_OPTIONS} варіантів`);
    const options = opts.map((o: any, k: number): Option => ({
      id: o?.id ? id(o.id, 'Варіант') : null,
      text: str(o?.text, `${n}, варіант ${k + 1}`, { max: 200 }),
      correct: o?.correct === true,
    }));
    const texts = options.map((o: Option) => o.text.toLowerCase());
    if (new Set(texts).size !== texts.length) throw bad(`${n}: варіанти повторюються`);
    if (!options.some((o: Option) => o.correct)) throw bad(`${n}: позначте хоча б одну правильну відповідь`);
    return { id: x?.id ? id(x.id, 'Питання') : null, text, image, options };
  });
  return { title, description, questions };
}

/**
 * Записує питання тесту. Наявні оновлюються за id, нові додаються, зайві видаляються:
 * так відповіді вже пройдених спроб лишаються прив'язаними до тих самих питань.
 */
async function saveQuestions(t: Query, quizId: number, questions: Question[]) {
  const images = [...new Set(questions.map((x) => x.image).filter(Boolean))];
  if (images.length) {
    const found = await t('SELECT stored_name FROM quiz_images WHERE stored_name IN (?)', [images]);
    if (found.length !== images.length) throw bad('Картинку не знайдено. Завантажте її ще раз.');
  }
  const oldQ: Row[] = await t('SELECT id FROM quiz_questions WHERE quiz_id=?', [quizId]);
  const oldIds = new Set(oldQ.map((r) => r.id));
  const keptQ: number[] = [];
  for (const [i, x] of questions.entries()) {
    let qid = x.id && oldIds.has(x.id) ? x.id : null;
    if (qid) await t('UPDATE quiz_questions SET position=?, text=?, image=? WHERE id=?', [i + 1, x.text, x.image, qid]);
    else qid = (await t('INSERT INTO quiz_questions (quiz_id, position, text, image) VALUES (?,?,?,?)', [quizId, i + 1, x.text, x.image])).insertId as number;
    keptQ.push(qid);
    const oldO = new Set(((await t('SELECT id FROM quiz_options WHERE question_id=?', [qid])) as Row[]).map((r) => r.id));
    const keptO: number[] = [];
    for (const [k, o] of x.options.entries()) {
      if (o.id && oldO.has(o.id)) {
        await t('UPDATE quiz_options SET position=?, text=?, is_correct=? WHERE id=?', [k + 1, o.text, o.correct ? 1 : 0, o.id]);
        keptO.push(o.id);
      } else {
        keptO.push((await t('INSERT INTO quiz_options (question_id, position, text, is_correct) VALUES (?,?,?,?)', [qid, k + 1, o.text, o.correct ? 1 : 0])).insertId);
      }
    }
    await t('DELETE FROM quiz_options WHERE question_id=? AND id NOT IN (?)', [qid, keptO]);
  }
  await t('DELETE FROM quiz_questions WHERE quiz_id=? AND id NOT IN (?)', [quizId, keptQ]);
}

/** Картинки, які ніде не використовуються вже добу: завантажили, але тест так і не зберегли. */
async function dropOrphanImages() {
  const stale: Row[] = await q(
    `SELECT i.stored_name FROM quiz_images i
      WHERE i.created_at < NOW() - INTERVAL 1 DAY
        AND NOT EXISTS (SELECT 1 FROM quiz_questions x WHERE x.image = i.stored_name)`
  );
  for (const { stored_name: name } of stale) {
    await q('DELETE FROM quiz_images WHERE stored_name=?', [name]);
    await removeFile(name);
  }
}

interface LoadedQuestion { id: number; text: string; image: string | null; multiple: boolean; options: { id: number; text: string; correct?: boolean }[] }

async function loadQuestions(quizId: number, { withCorrect }: { withCorrect: boolean }): Promise<LoadedQuestion[]> {
  const questions: Row[] = await q('SELECT id, text, image FROM quiz_questions WHERE quiz_id=? ORDER BY position, id', [quizId]);
  const options: Row[] = questions.length
    ? await q('SELECT id, question_id, text, is_correct FROM quiz_options WHERE question_id IN (?) ORDER BY position, id', [questions.map((x) => x.id)])
    : [];
  return questions.map((x) => {
    const own = options.filter((o) => o.question_id === x.id);
    return {
      id: x.id,
      text: x.text,
      image: x.image,
      // Учень бачить, що правильних кілька, лише як підказку до типу відповіді.
      multiple: own.filter((o) => o.is_correct).length > 1,
      options: own.map((o) => (withCorrect ? { id: o.id, text: o.text, correct: Boolean(o.is_correct) } : { id: o.id, text: o.text })),
    };
  });
}

async function loadQuiz(quizId: number): Promise<Row> {
  const [quiz] = await q('SELECT z.*, u.name AS author_name FROM quizzes z LEFT JOIN users u ON u.id = z.created_by WHERE z.id=?', [quizId]);
  if (!quiz) throw notFound('Тест не знайдено');
  return quiz;
}
/** Вчитель бачить і змінює лише власні тести; схвалений тест далі веде менеджер. */
function assertAuthor(user: User, quiz: Row, { edit }: { edit: boolean }) {
  if (user.role === 'manager') return;
  if (quiz.created_by !== user.id) throw notFound('Тест не знайдено');
  if (edit && quiz.status === 'approved') throw forbidden('Тест уже схвалено. Змінити його може менеджер.');
}

const ASSIGN_SELECT = `
  SELECT a.id, a.quiz_id, a.student_id, a.course_id, a.due_at, a.created_at, a.submitted_at, a.score, a.max_score,
         z.title AS quiz_title, z.description, u.name AS student_name, u.avatar AS student_avatar, c.title AS course_title,
         (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = a.quiz_id) AS questions_count
    FROM quiz_assignments a
    JOIN quizzes z ON z.id = a.quiz_id
    JOIN users u ON u.id = a.student_id
    LEFT JOIN courses c ON c.id = a.course_id`;

const assignTopics = (assignmentId: number) => topicsOf('quiz_assignment_topics', 'assignment_id', assignmentId);

async function loadAssignment(assignmentId: number): Promise<Row> {
  const [a] = await q(`${ASSIGN_SELECT} WHERE a.id=?`, [assignmentId]);
  if (!a) throw notFound('Тест не знайдено');
  return a;
}
function assertOwnerOrManager(user: User, a: Row) {
  if (user.role === 'manager' || (user.role === 'student' && a.student_id === user.id)) return;
  throw forbidden();
}

interface Pick { question_id: number; option_id: number }
function isRight(question: LoadedQuestion, chosen: Pick[]): boolean {
  const picked = new Set(chosen.filter((c) => c.question_id === question.id).map((c) => c.option_id));
  const correct = question.options.filter((o) => o.correct).map((o) => o.id);
  return picked.size === correct.length && correct.every((oid) => picked.has(oid));
}

/* Картинки питань */
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, _file, cb) => cb(null, `${randomUUID()}.bin`) }),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1, fields: 0 },
}).single('image');

/* Призначення: учень, курс і теми */
async function parseAssignment(b: any) {
  const courseId = b?.course_id ? id(b.course_id, 'Курс') : null;
  if (courseId) {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    if (!c) throw bad('Курс не знайдено');
  }
  const dueAt = b?.due_at ? dateTime(b.due_at, 'Пройти до') : null;
  const topics = await parseTopics(b?.topics ?? [], courseId);
  return { courseId, dueAt, topics };
}

@Injectable()
export class QuizzesService {
  /** Учень: свої тести. */
  my(user: User) {
    return q(`${ASSIGN_SELECT} WHERE a.student_id=? ORDER BY a.submitted_at IS NOT NULL, a.created_at DESC`, [user.id]);
  }

  async uploadImage(user: User, req: Request, res: Response) {
    const err = await new Promise<unknown>((resolve) => upload(req, res, resolve));
    try {
      if (err) throw (err as multer.MulterError).code === 'LIMIT_FILE_SIZE' ? bad(`Картинка завелика: максимум ${MAX_IMAGE_MB} МБ`) : bad('Не вдалося завантажити картинку');
      if (!req.file) throw bad('Оберіть картинку');
      const mime = imageMime(await readHead(req.file.path));
      if (!mime) throw bad('Картинка: PNG, JPG, WEBP або GIF');
      await persistFile(req.file.filename);
      await q('INSERT INTO quiz_images (stored_name, mime, size, created_by) VALUES (?,?,?,?)', [req.file.filename, mime, req.file.size, user.id]);
      return { image: req.file.filename };
    } catch (e) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      throw e;
    }
  }

  async sendImage(user: User, name: string, res: Response) {
    if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
    const [img] = await q('SELECT * FROM quiz_images WHERE stored_name=?', [name]);
    if (!img) throw notFound('Картинку не знайдено');
    if (user.role === 'student') {
      // Учень бачить картинку лише з тесту, відкритого саме йому.
      const [hit] = await q(
        `SELECT 1 FROM quiz_questions x JOIN quiz_assignments a ON a.quiz_id = x.quiz_id
          WHERE x.image=? AND a.student_id=? LIMIT 1`,
        [name, user.id]
      );
      if (!hit) throw notFound('Картинку не знайдено');
    } else if (user.role === 'teacher') {
      const [own] = await q(
        `SELECT 1 FROM quiz_images i WHERE i.stored_name=? AND (i.created_by=?
            OR EXISTS (SELECT 1 FROM quiz_questions x JOIN quizzes z ON z.id = x.quiz_id WHERE x.image = i.stored_name AND z.created_by=?)) LIMIT 1`,
        [name, user.id, user.id]
      );
      if (!own) throw notFound('Картинку не знайдено');
    } else if (user.role !== 'manager') {
      throw notFound('Картинку не знайдено');
    }
    let stream: NodeJS.ReadableStream;
    try {
      stream = await openFile(name);
    } catch {
      throw notFound('Картинку не знайдено');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Content-Length', img.size);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Disposition', contentDisposition('image', true));
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  async updateAssignment(aidValue: unknown, body: any) {
    const a = await loadAssignment(id(aidValue));
    const { courseId, dueAt, topics } = await parseAssignment(body);
    await tx(async (t) => {
      await t('UPDATE quiz_assignments SET course_id=?, due_at=? WHERE id=?', [courseId, dueAt, a.id]);
      await saveTopics(t, 'quiz_assignment_topics', 'assignment_id', a.id, topics);
    });
    return { ok: true };
  }

  async removeAssignment(aidValue: unknown) {
    const r = await q('DELETE FROM quiz_assignments WHERE id=?', [id(aidValue)]);
    if (!r.affectedRows) throw notFound('Тест не знайдено');
    return { ok: true };
  }

  /** Ще одна спроба: відповіді й бал стираються, тест знову чекає на учня. */
  async resetAssignment(aidValue: unknown) {
    const a = await loadAssignment(id(aidValue));
    await tx(async (t) => {
      await t('DELETE FROM quiz_answers WHERE assignment_id=?', [a.id]);
      await t('UPDATE quiz_assignments SET submitted_at=NULL, score=NULL, max_score=NULL WHERE id=?', [a.id]);
    });
    return { ok: true };
  }

  async getAssignment(user: User, aidValue: unknown) {
    const a = await loadAssignment(id(aidValue));
    assertOwnerOrManager(user, a);
    const done = Boolean(a.submitted_at);
    // Правильні відповіді учень бачить лише після здачі.
    const questions = await loadQuestions(a.quiz_id, { withCorrect: done || user.role === 'manager' });
    const chosen: Pick[] = done ? await q('SELECT question_id, option_id FROM quiz_answers WHERE assignment_id=?', [a.id]) : [];
    return {
      ...a,
      topics: await assignTopics(a.id),
      questions: questions.map((x) => ({
        ...x,
        chosen: chosen.filter((c) => c.question_id === x.id).map((c) => c.option_id),
        ...(done ? { right: isRight(x, chosen) } : {}),
      })),
    };
  }

  async submit(user: User, aidValue: unknown, body: any) {
    const a = await loadAssignment(id(aidValue));
    if (a.student_id !== user.id) throw forbidden();
    const raw = body?.answers;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('Відповіді передано неправильно');
    const questions = await loadQuestions(a.quiz_id, { withCorrect: true });
    const picks: Pick[] = [];
    for (const x of questions) {
      const list = raw[x.id] ?? raw[String(x.id)] ?? [];
      if (!Array.isArray(list)) throw bad('Відповіді передано неправильно');
      const ids = [...new Set(list.map((v: unknown) => id(v, 'Варіант')))];
      if (ids.some((oid) => !x.options.some((o) => o.id === oid))) throw bad('Варіант не з цього питання');
      if (!x.multiple && ids.length > 1) throw bad('У цьому питанні лише одна правильна відповідь');
      for (const oid of ids) picks.push({ question_id: x.id, option_id: oid });
    }
    const score = questions.filter((x) => isRight(x, picks)).length;
    await tx(async (t) => {
      const [cur] = await t('SELECT submitted_at FROM quiz_assignments WHERE id=? FOR UPDATE', [a.id]);
      if (cur.submitted_at) throw conflict('Тест уже пройдено');
      if (picks.length) await t('INSERT INTO quiz_answers (assignment_id, question_id, option_id) VALUES ?', [picks.map((p) => [a.id, p.question_id, p.option_id])]);
      await t('UPDATE quiz_assignments SET submitted_at=?, score=?, max_score=? WHERE id=?', [nowStr(), score, questions.length, a.id]);
    });
    return { score, max_score: questions.length };
  }

  /* Тести: менеджер бачить усі (модерація окремим списком), вчитель — власні */
  list(user: User) {
    const own = user.role === 'teacher';
    return q(
      `SELECT z.*, u.name AS author_name, u.role AS author_role,
          (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = z.id) AS questions_count,
          (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id) AS assigned_count,
          (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id AND a.submitted_at IS NOT NULL) AS done_count
         FROM quizzes z LEFT JOIN users u ON u.id = z.created_by
        ${own ? 'WHERE z.created_by = ?' : ''}
        ORDER BY z.updated_at DESC, z.id DESC`,
      own ? [user.id] : []
    );
  }

  /** Тести, які можна поставити на острівець: схвалені й власні вчителя, що ще на модерації. */
  library(user: User) {
    return q(
      `SELECT z.id, z.title, z.status, (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = z.id) AS questions_count
         FROM quizzes z
        WHERE z.status = 'approved' OR (z.status = 'pending' AND z.created_by = ?)
        ORDER BY z.updated_at DESC, z.id DESC`,
      [user.id]
    );
  }

  async approve(idValue: unknown) {
    const quiz = await loadQuiz(id(idValue));
    await q("UPDATE quizzes SET status='approved', review_note=NULL WHERE id=?", [quiz.id]);
    return { ok: true };
  }

  async reject(idValue: unknown, body: any) {
    const quiz = await loadQuiz(id(idValue));
    if (quiz.status === 'approved') throw conflict('Тест уже схвалено');
    const note = str(body?.note, 'Причина', { max: 300, required: false });
    await q("UPDATE quizzes SET status='rejected', review_note=? WHERE id=?", [note, quiz.id]);
    return { ok: true };
  }

  async create(user: User, body: any) {
    const quiz = parseQuiz(body);
    const status = user.role === 'manager' ? 'approved' : 'pending';
    const quizId = await tx(async (t) => {
      const r = await t('INSERT INTO quizzes (title, description, status, created_by) VALUES (?,?,?,?)', [quiz.title, quiz.description, status, user.id]);
      await saveQuestions(t, r.insertId, quiz.questions.map((x) => ({ ...x, id: null, options: x.options.map((o) => ({ ...o, id: null })) })));
      return r.insertId as number;
    });
    await dropOrphanImages().catch((e) => console.error(e));
    return { id: quizId, status };
  }

  async get(user: User, idValue: unknown) {
    const quiz = await loadQuiz(id(idValue));
    assertAuthor(user, quiz, { edit: false });
    const assignments: Row[] = user.role === 'manager' ? await q(`${ASSIGN_SELECT} WHERE a.quiz_id=? ORDER BY u.name`, [quiz.id]) : [];
    const topics: Row[] = assignments.length
      ? await q(
          `SELECT t.assignment_id, t.step_id, t.substep_id, s.title AS step_title, x.title AS substep_title
             FROM quiz_assignment_topics t JOIN roadmap_steps s ON s.id = t.step_id
             LEFT JOIN roadmap_substeps x ON x.id = t.substep_id
            WHERE t.assignment_id IN (?) ORDER BY s.position, x.position`,
          [assignments.map((a) => a.id)]
        )
      : [];
    return {
      ...quiz,
      questions: await loadQuestions(quiz.id, { withCorrect: true }),
      assignments: assignments.map((a) => ({ ...a, topics: topics.filter((t) => t.assignment_id === a.id) })),
    };
  }

  async update(user: User, idValue: unknown, body: any) {
    const quiz = await loadQuiz(id(idValue));
    assertAuthor(user, quiz, { edit: true });
    const next = parseQuiz(body);
    // Виправлений вчителем тест знову йде на модерацію.
    const status = user.role === 'manager' ? quiz.status : 'pending';
    await tx(async (t) => {
      await t('UPDATE quizzes SET title=?, description=?, status=?, updated_at=? WHERE id=?', [next.title, next.description, status, nowStr(), quiz.id]);
      await saveQuestions(t, quiz.id, next.questions);
    });
    await dropOrphanImages().catch((e) => console.error(e));
    return { ok: true };
  }

  async remove(user: User, idValue: unknown) {
    const quiz = await loadQuiz(id(idValue));
    assertAuthor(user, quiz, { edit: true });
    await q('DELETE FROM quizzes WHERE id=?', [quiz.id]);
    return { ok: true };
  }

  async assign(user: User, idValue: unknown, body: any) {
    const quiz = await loadQuiz(id(idValue));
    if (quiz.status !== 'approved') throw bad('Тест ще не схвалено');
    const studentId = id(body?.student_id, 'Учень');
    const [student] = await q(`SELECT id FROM users WHERE id=? AND role='student' AND is_active=1`, [studentId]);
    if (!student) throw bad('Учня не знайдено');
    const [{ n }] = await q('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id=?', [quiz.id]);
    if (!n) throw bad('У тесті немає питань');
    const { courseId, dueAt, topics } = await parseAssignment(body);
    const [exists] = await q('SELECT 1 FROM quiz_assignments WHERE quiz_id=? AND student_id=?', [quiz.id, studentId]);
    if (exists) throw conflict('Цей тест уже відкрито учневі');
    const assignmentId = await tx(async (t) => {
      const r = await t('INSERT INTO quiz_assignments (quiz_id, student_id, course_id, due_at, assigned_by) VALUES (?,?,?,?,?)', [
        quiz.id, studentId, courseId, dueAt, user.id,
      ]);
      await saveTopics(t, 'quiz_assignment_topics', 'assignment_id', r.insertId, topics);
      return r.insertId as number;
    });
    return { id: assignmentId };
  }
}

/** Сповіщення учня: непройдені тести та нові оцінки чи відгуки до домашніх. */
@Injectable()
export class NotificationsService {
  async count(user: User) {
    if (user.role === 'manager') {
      const [{ pending }] = await q("SELECT COUNT(*) AS pending FROM quizzes WHERE status='pending'");
      return { count: Number(pending), quizzes: 0, reviews: 0, moderation: Number(pending) };
    }
    if (user.role !== 'student') return { count: 0, quizzes: 0, reviews: 0 };
    const [{ quizzes }] = await q('SELECT COUNT(*) AS quizzes FROM quiz_assignments WHERE student_id=? AND submitted_at IS NULL', [user.id]);
    const [{ reviews }] = await q(
      // Лише домашні, задані учневі зараз: інакше роботу не відкрити, і сповіщення не згасне.
      `SELECT COUNT(*) AS reviews FROM submissions s JOIN homework h ON h.id = s.homework_id
        WHERE s.student_id=? AND s.reviewed_at IS NOT NULL AND s.seen_at IS NULL AND ${HW_FOR('h', 's.student_id')}`,
      [user.id]
    );
    return { count: Number(quizzes) + Number(reviews), quizzes: Number(quizzes), reviews: Number(reviews) };
  }
}
