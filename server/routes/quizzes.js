import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import multer from 'multer';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { bad, conflict, dateTime, forbidden, id, notFound, nowStr, str } from '../lib.js';
import { UPLOAD_DIR, openFile, persistFile, removeFile } from '../storage.js';
import { parseTopics, saveTopics, topicsOf } from '../topics.js';
import { contentDisposition, imageMime, readHead } from './homework.js';
import { HW_FOR } from '../audience.js';

/*
 * Тести. Менеджер створює тест (вручну або вставляє відповідь зовнішнього ШІ, її розбирає клієнт) і відкриває його учневі окремо.
 * Учень проходить один раз; бал рахується на сервері й зберігається в призначенні.
 */
export const quizzesRouter = Router();
export const notificationsRouter = Router();
quizzesRouter.use(requireAuth);
notificationsRouter.use(requireAuth);

export const MAX_QUESTIONS = 40;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;
const MAX_IMAGE_MB = 5;
const IMAGE_NAME = /^[0-9a-f-]{36}\.bin$/;

/* Розбір тесту з форми */
function parseQuiz(b) {
  const title = str(b?.title, 'Назва тесту', { max: 160 });
  const description = str(b?.description, 'Опис', { max: 1000, required: false });
  const raw = b?.questions;
  if (!Array.isArray(raw) || !raw.length) throw bad('Додайте хоча б одне питання');
  if (raw.length > MAX_QUESTIONS) throw bad(`Максимум ${MAX_QUESTIONS} питань`);
  const questions = raw.map((x, i) => {
    const n = `Питання ${i + 1}`;
    const text = str(x?.text, `${n}: текст`, { max: 500 });
    const image = x?.image ? String(x.image) : null;
    if (image && !IMAGE_NAME.test(image)) throw bad(`${n}: картинку не знайдено`);
    const opts = Array.isArray(x?.options) ? x.options : [];
    if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) throw bad(`${n}: потрібно від ${MIN_OPTIONS} до ${MAX_OPTIONS} варіантів`);
    const options = opts.map((o, k) => ({
      id: o?.id ? id(o.id, 'Варіант') : null,
      text: str(o?.text, `${n}, варіант ${k + 1}`, { max: 200 }),
      correct: o?.correct === true,
    }));
    const texts = options.map((o) => o.text.toLowerCase());
    if (new Set(texts).size !== texts.length) throw bad(`${n}: варіанти повторюються`);
    if (!options.some((o) => o.correct)) throw bad(`${n}: позначте хоча б одну правильну відповідь`);
    return { id: x?.id ? id(x.id, 'Питання') : null, text, image, options };
  });
  return { title, description, questions };
}

/**
 * Записує питання тесту. Наявні оновлюються за id, нові додаються, зайві видаляються:
 * так відповіді вже пройдених спроб лишаються прив'язаними до тих самих питань.
 */
async function saveQuestions(t, quizId, questions) {
  const images = [...new Set(questions.map((x) => x.image).filter(Boolean))];
  if (images.length) {
    const found = await t('SELECT stored_name FROM quiz_images WHERE stored_name IN (?)', [images]);
    if (found.length !== images.length) throw bad('Картинку не знайдено. Завантажте її ще раз.');
  }
  const oldQ = await t('SELECT id FROM quiz_questions WHERE quiz_id=?', [quizId]);
  const oldIds = new Set(oldQ.map((r) => r.id));
  const keptQ = [];
  for (const [i, x] of questions.entries()) {
    let qid = x.id && oldIds.has(x.id) ? x.id : null;
    if (qid) await t('UPDATE quiz_questions SET position=?, text=?, image=? WHERE id=?', [i + 1, x.text, x.image, qid]);
    else qid = (await t('INSERT INTO quiz_questions (quiz_id, position, text, image) VALUES (?,?,?,?)', [quizId, i + 1, x.text, x.image])).insertId;
    keptQ.push(qid);
    const oldO = new Set((await t('SELECT id FROM quiz_options WHERE question_id=?', [qid])).map((r) => r.id));
    const keptO = [];
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
  const stale = await q(
    `SELECT i.stored_name FROM quiz_images i
      WHERE i.created_at < NOW() - INTERVAL 1 DAY
        AND NOT EXISTS (SELECT 1 FROM quiz_questions x WHERE x.image = i.stored_name)`
  );
  for (const { stored_name: name } of stale) {
    await q('DELETE FROM quiz_images WHERE stored_name=?', [name]);
    await removeFile(name);
  }
}

async function loadQuestions(quizId, { withCorrect }) {
  const questions = await q('SELECT id, text, image FROM quiz_questions WHERE quiz_id=? ORDER BY position, id', [quizId]);
  const options = questions.length
    ? await q('SELECT id, question_id, text, is_correct FROM quiz_options WHERE question_id IN (?) ORDER BY position, id', [questions.map((x) => x.id)])
    : [];
  return questions.map((x) => {
    const own = options.filter((o) => o.question_id === x.id);
    return {
      ...x,
      // Учень бачить, що правильних кілька, лише як підказку до типу відповіді.
      multiple: own.filter((o) => o.is_correct).length > 1,
      options: own.map((o) => (withCorrect ? { id: o.id, text: o.text, correct: Boolean(o.is_correct) } : { id: o.id, text: o.text })),
    };
  });
}

async function loadQuiz(quizId) {
  const [quiz] = await q('SELECT * FROM quizzes WHERE id=?', [quizId]);
  if (!quiz) throw notFound('Тест не знайдено');
  return quiz;
}

const ASSIGN_SELECT = `
  SELECT a.id, a.quiz_id, a.student_id, a.course_id, a.due_at, a.created_at, a.submitted_at, a.score, a.max_score,
         z.title AS quiz_title, z.description, u.name AS student_name, c.title AS course_title,
         (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = a.quiz_id) AS questions_count
    FROM quiz_assignments a
    JOIN quizzes z ON z.id = a.quiz_id
    JOIN users u ON u.id = a.student_id
    LEFT JOIN courses c ON c.id = a.course_id`;

const assignTopics = (assignmentId) => topicsOf('quiz_assignment_topics', 'assignment_id', assignmentId);

async function loadAssignment(assignmentId) {
  const [a] = await q(`${ASSIGN_SELECT} WHERE a.id=?`, [assignmentId]);
  if (!a) throw notFound('Тест не знайдено');
  return a;
}
function assertOwnerOrManager(user, a) {
  if (user.role === 'manager' || (user.role === 'student' && a.student_id === user.id)) return;
  throw forbidden();
}

/* Учень: свої тести */
quizzesRouter.get('/my', requireRole('student'), async (req, res) => {
  res.json(await q(`${ASSIGN_SELECT} WHERE a.student_id=? ORDER BY a.submitted_at IS NOT NULL, a.created_at DESC`, [req.user.id]));
});

/* Картинки питань */
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_req, _file, cb) => cb(null, `${randomUUID()}.bin`) }),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 1, fields: 0 },
}).single('image');

quizzesRouter.post('/images', requireRole('manager'), (req, res, next) => {
  upload(req, res, async (err) => {
    try {
      if (err) throw err.code === 'LIMIT_FILE_SIZE' ? bad(`Картинка завелика: максимум ${MAX_IMAGE_MB} МБ`) : bad('Не вдалося завантажити картинку');
      if (!req.file) throw bad('Оберіть картинку');
      const mime = imageMime(await readHead(req.file.path));
      if (!mime) throw bad('Картинка: PNG, JPG, WEBP або GIF');
      await persistFile(req.file.filename);
      await q('INSERT INTO quiz_images (stored_name, mime, size, created_by) VALUES (?,?,?,?)', [req.file.filename, mime, req.file.size, req.user.id]);
      res.status(201).json({ image: req.file.filename });
    } catch (e) {
      if (req.file) await unlink(req.file.path).catch(() => {});
      next(e);
    }
  });
});

quizzesRouter.get('/images/:name', async (req, res) => {
  const name = req.params.name;
  if (!IMAGE_NAME.test(name)) throw notFound('Картинку не знайдено');
  const [img] = await q('SELECT * FROM quiz_images WHERE stored_name=?', [name]);
  if (!img) throw notFound('Картинку не знайдено');
  if (req.user.role === 'student') {
    // Учень бачить картинку лише з тесту, відкритого саме йому.
    const [hit] = await q(
      `SELECT 1 FROM quiz_questions x JOIN quiz_assignments a ON a.quiz_id = x.quiz_id
        WHERE x.image=? AND a.student_id=? LIMIT 1`,
      [name, req.user.id]
    );
    if (!hit) throw notFound('Картинку не знайдено');
  } else if (req.user.role !== 'manager') {
    throw notFound('Картинку не знайдено');
  }
  let stream;
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
});

/* Призначення: учень, курс і теми */
async function parseAssignment(b) {
  const courseId = b?.course_id ? id(b.course_id, 'Курс') : null;
  if (courseId) {
    const [c] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    if (!c) throw bad('Курс не знайдено');
  }
  const dueAt = b?.due_at ? dateTime(b.due_at, 'Пройти до') : null;
  const topics = await parseTopics(b?.topics ?? [], courseId);
  return { courseId, dueAt, topics };
}

quizzesRouter.patch('/assignments/:aid', requireRole('manager'), async (req, res) => {
  const a = await loadAssignment(id(req.params.aid));
  const { courseId, dueAt, topics } = await parseAssignment(req.body);
  await tx(async (t) => {
    await t('UPDATE quiz_assignments SET course_id=?, due_at=? WHERE id=?', [courseId, dueAt, a.id]);
    await saveTopics(t, 'quiz_assignment_topics', 'assignment_id', a.id, topics);
  });
  res.json({ ok: true });
});

quizzesRouter.delete('/assignments/:aid', requireRole('manager'), async (req, res) => {
  const r = await q('DELETE FROM quiz_assignments WHERE id=?', [id(req.params.aid)]);
  if (!r.affectedRows) throw notFound('Тест не знайдено');
  res.json({ ok: true });
});

// Ще одна спроба: відповіді й бал стираються, тест знову чекає на учня.
quizzesRouter.post('/assignments/:aid/reset', requireRole('manager'), async (req, res) => {
  const a = await loadAssignment(id(req.params.aid));
  await tx(async (t) => {
    await t('DELETE FROM quiz_answers WHERE assignment_id=?', [a.id]);
    await t('UPDATE quiz_assignments SET submitted_at=NULL, score=NULL, max_score=NULL WHERE id=?', [a.id]);
  });
  res.json({ ok: true });
});

quizzesRouter.get('/assignments/:aid', async (req, res) => {
  const a = await loadAssignment(id(req.params.aid));
  assertOwnerOrManager(req.user, a);
  const done = Boolean(a.submitted_at);
  // Правильні відповіді учень бачить лише після здачі.
  const questions = await loadQuestions(a.quiz_id, { withCorrect: done || req.user.role === 'manager' });
  const chosen = done ? await q('SELECT question_id, option_id FROM quiz_answers WHERE assignment_id=?', [a.id]) : [];
  res.json({
    ...a,
    topics: await assignTopics(a.id),
    questions: questions.map((x) => ({
      ...x,
      chosen: chosen.filter((c) => c.question_id === x.id).map((c) => c.option_id),
      ...(done ? { right: isRight(x, chosen) } : {}),
    })),
  });
});

function isRight(question, chosen) {
  const picked = new Set(chosen.filter((c) => c.question_id === question.id).map((c) => c.option_id));
  const correct = question.options.filter((o) => o.correct).map((o) => o.id);
  return picked.size === correct.length && correct.every((oid) => picked.has(oid));
}

quizzesRouter.post('/assignments/:aid/submit', requireRole('student'), async (req, res) => {
  const a = await loadAssignment(id(req.params.aid));
  if (a.student_id !== req.user.id) throw forbidden();
  const raw = req.body?.answers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('Відповіді передано неправильно');
  const questions = await loadQuestions(a.quiz_id, { withCorrect: true });
  const picks = [];
  for (const x of questions) {
    const list = raw[x.id] ?? raw[String(x.id)] ?? [];
    if (!Array.isArray(list)) throw bad('Відповіді передано неправильно');
    const ids = [...new Set(list.map((v) => id(v, 'Варіант')))];
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
  res.json({ score, max_score: questions.length });
});

/* Менеджер: тести */
quizzesRouter.get('/', requireRole('manager'), async (_req, res) => {
  res.json(await q(
    `SELECT z.*,
        (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = z.id) AS questions_count,
        (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id) AS assigned_count,
        (SELECT COUNT(*) FROM quiz_assignments a WHERE a.quiz_id = z.id AND a.submitted_at IS NOT NULL) AS done_count
       FROM quizzes z ORDER BY z.updated_at DESC, z.id DESC`
  ));
});

quizzesRouter.post('/', requireRole('manager'), async (req, res) => {
  const quiz = parseQuiz(req.body);
  const quizId = await tx(async (t) => {
    const r = await t('INSERT INTO quizzes (title, description, created_by) VALUES (?,?,?)', [quiz.title, quiz.description, req.user.id]);
    await saveQuestions(t, r.insertId, quiz.questions.map((x) => ({ ...x, id: null, options: x.options.map((o) => ({ ...o, id: null })) })));
    return r.insertId;
  });
  await dropOrphanImages().catch((e) => console.error(e));
  res.status(201).json({ id: quizId });
});

quizzesRouter.get('/:id', requireRole('manager'), async (req, res) => {
  const quiz = await loadQuiz(id(req.params.id));
  const assignments = await q(`${ASSIGN_SELECT} WHERE a.quiz_id=? ORDER BY u.name`, [quiz.id]);
  const topics = assignments.length
    ? await q(
        `SELECT t.assignment_id, t.step_id, t.substep_id, s.title AS step_title, x.title AS substep_title
           FROM quiz_assignment_topics t JOIN roadmap_steps s ON s.id = t.step_id
           LEFT JOIN roadmap_substeps x ON x.id = t.substep_id
          WHERE t.assignment_id IN (?) ORDER BY s.position, x.position`,
        [assignments.map((a) => a.id)]
      )
    : [];
  res.json({
    ...quiz,
    questions: await loadQuestions(quiz.id, { withCorrect: true }),
    assignments: assignments.map((a) => ({ ...a, topics: topics.filter((t) => t.assignment_id === a.id) })),
  });
});

quizzesRouter.put('/:id', requireRole('manager'), async (req, res) => {
  const quiz = await loadQuiz(id(req.params.id));
  const next = parseQuiz(req.body);
  await tx(async (t) => {
    await t('UPDATE quizzes SET title=?, description=?, updated_at=? WHERE id=?', [next.title, next.description, nowStr(), quiz.id]);
    await saveQuestions(t, quiz.id, next.questions);
  });
  await dropOrphanImages().catch((e) => console.error(e));
  res.json({ ok: true });
});

quizzesRouter.delete('/:id', requireRole('manager'), async (req, res) => {
  const quiz = await loadQuiz(id(req.params.id));
  await q('DELETE FROM quizzes WHERE id=?', [quiz.id]);
  res.json({ ok: true });
});

quizzesRouter.post('/:id/assignments', requireRole('manager'), async (req, res) => {
  const quiz = await loadQuiz(id(req.params.id));
  const studentId = id(req.body?.student_id, 'Учень');
  const [student] = await q(`SELECT id FROM users WHERE id=? AND role='student' AND is_active=1`, [studentId]);
  if (!student) throw bad('Учня не знайдено');
  const [{ n }] = await q('SELECT COUNT(*) n FROM quiz_questions WHERE quiz_id=?', [quiz.id]);
  if (!n) throw bad('У тесті немає питань');
  const { courseId, dueAt, topics } = await parseAssignment(req.body);
  const [exists] = await q('SELECT 1 FROM quiz_assignments WHERE quiz_id=? AND student_id=?', [quiz.id, studentId]);
  if (exists) throw conflict('Цей тест уже відкрито учневі');
  const assignmentId = await tx(async (t) => {
    const r = await t('INSERT INTO quiz_assignments (quiz_id, student_id, course_id, due_at, assigned_by) VALUES (?,?,?,?,?)', [
      quiz.id, studentId, courseId, dueAt, req.user.id,
    ]);
    await saveTopics(t, 'quiz_assignment_topics', 'assignment_id', r.insertId, topics);
    return r.insertId;
  });
  res.status(201).json({ id: assignmentId });
});

/* Сповіщення учня: непройдені тести та нові оцінки чи відгуки до домашніх */
notificationsRouter.get('/', async (req, res) => {
  if (req.user.role !== 'student') return res.json({ count: 0, quizzes: 0, reviews: 0 });
  const [{ quizzes }] = await q('SELECT COUNT(*) AS quizzes FROM quiz_assignments WHERE student_id=? AND submitted_at IS NULL', [req.user.id]);
  const [{ reviews }] = await q(
    // Лише домашні групи, де учень зараз: інакше роботу не відкрити, і сповіщення не згасне.
    `SELECT COUNT(*) AS reviews FROM submissions s JOIN homework h ON h.id = s.homework_id
      WHERE s.student_id=? AND s.reviewed_at IS NOT NULL AND s.seen_at IS NULL AND ${HW_FOR('h', 's.student_id')}`,
    [req.user.id]
  );
  res.json({ count: Number(quizzes) + Number(reviews), quizzes: Number(quizzes), reviews: Number(reviews) });
});

