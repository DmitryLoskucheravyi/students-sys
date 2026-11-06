import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { q, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { draftRoadmap, normalizeSteps } from '../ai.js';
import { bad, conflict, forbidden, id, idList, notFound, str } from '../lib.js';

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

/** Вчитель редагує роадмап лише курсів, які сам веде. */
async function canEdit(user, courseId) {
  if (user.role === 'manager') return true;
  if (user.role !== 'teacher') return false;
  const [hit] = await q('SELECT 1 FROM lessons WHERE course_id=? AND teacher_id=? AND is_active=1 LIMIT 1', [
    courseId, user.id,
  ]);
  return Boolean(hit);
}
async function assertEdit(user, courseId) {
  if (!(await canEdit(user, courseId))) throw forbidden('Цей курс веде інший вчитель');
}
async function canView(user, courseId) {
  if (user.role === 'manager') return true;
  if (user.role === 'teacher') return canEdit(user, courseId);
  const [hit] = await q(
    `SELECT 1 FROM lessons l JOIN lesson_students ls ON ls.lesson_id = l.id
      WHERE l.course_id=? AND ls.student_id=? LIMIT 1`,
    [courseId, user.id]
  );
  return Boolean(hit);
}

coursesRouter.get('/', async (req, res) => {
  const { role, id: me } = req.user;
  const scope =
    role === 'manager'
      ? ''
      : role === 'teacher'
        ? 'WHERE EXISTS (SELECT 1 FROM lessons l WHERE l.course_id = c.id AND l.teacher_id = ? AND l.is_active = 1)'
        : `WHERE EXISTS (SELECT 1 FROM lessons l JOIN lesson_students ls ON ls.lesson_id = l.id
                          WHERE l.course_id = c.id AND ls.student_id = ?)`;
  const rows = await q(
    `SELECT c.*,
        (SELECT COUNT(*) FROM roadmap_steps s WHERE s.course_id = c.id) AS steps_count,
        (SELECT COUNT(DISTINCT ls.student_id) FROM lessons l JOIN lesson_students ls ON ls.lesson_id = l.id
          WHERE l.course_id = c.id AND l.is_active = 1) AS students_count,
        (SELECT COUNT(*) FROM roadmap_progress p JOIN roadmap_steps s ON s.id = p.step_id
          WHERE s.course_id = c.id AND p.student_id = ?) AS my_done
       FROM courses c ${scope} ORDER BY c.title`,
    role === 'manager' ? [me] : [me, me]
  );
  res.json(rows);
});

coursesRouter.post('/', requireRole('manager'), async (req, res) => {
  const b = req.body ?? {};
  const r = await q('INSERT INTO courses (title, summary) VALUES (?,?)', [
    str(b.title, 'Назва', { max: 120 }),
    str(b.summary, 'Опис', { max: 300, required: false }),
  ]);
  res.status(201).json((await q('SELECT * FROM courses WHERE id=?', [r.insertId]))[0]);
});

coursesRouter.get('/:id', async (req, res) => {
  const courseId = id(req.params.id);
  const [course] = await q('SELECT * FROM courses WHERE id=?', [courseId]);
  if (!course) throw notFound('Курс не знайдено');
  if (!(await canView(req.user, courseId))) throw forbidden();

  const steps = await q('SELECT * FROM roadmap_steps WHERE course_id=? ORDER BY position, id', [courseId]);
  const isStudent = req.user.role === 'student';

  // Учень бачить лише власний прогрес і не бачить інших учнів курсу.
  const students = isStudent
    ? []
    : await q(
        `SELECT DISTINCT u.id, u.name FROM users u
           JOIN lesson_students ls ON ls.student_id = u.id
           JOIN lessons l ON l.id = ls.lesson_id
          WHERE l.course_id = ? AND l.is_active = 1 ${req.user.role === 'teacher' ? 'AND l.teacher_id = ?' : ''}
          ORDER BY u.name`,
        req.user.role === 'teacher' ? [courseId, req.user.id] : [courseId]
      );
  const ids = isStudent ? [req.user.id] : students.map((s) => s.id);
  const progress = ids.length && steps.length
    ? await q(
        `SELECT p.student_id, p.step_id, p.done_at FROM roadmap_progress p
          WHERE p.student_id IN (?) AND p.step_id IN (?)`,
        [ids, steps.map((s) => s.id)]
      )
    : [];
  const substeps = steps.length
    ? await q('SELECT * FROM roadmap_substeps WHERE step_id IN (?) ORDER BY position, id', [steps.map((s) => s.id)])
    : [];
  const subProgress = ids.length && substeps.length
    ? await q(
        'SELECT student_id, substep_id FROM roadmap_substep_progress WHERE student_id IN (?) AND substep_id IN (?)',
        [ids, substeps.map((s) => s.id)]
      )
    : [];
  res.json({
    ...course,
    steps: steps.map((s) => ({ ...s, substeps: substeps.filter((x) => x.step_id === s.id) })),
    students,
    progress,
    sub_progress: subProgress,
    can_edit: await canEdit(req.user, courseId),
  });
});

coursesRouter.patch('/:id', requireRole('manager'), async (req, res) => {
  const courseId = id(req.params.id);
  const b = req.body ?? {};
  const r = await q('UPDATE courses SET title=?, summary=? WHERE id=?', [
    str(b.title, 'Назва', { max: 120 }),
    str(b.summary, 'Опис', { max: 300, required: false }),
    courseId,
  ]);
  if (!r.affectedRows) throw notFound();
  res.json({ ok: true });
});

coursesRouter.delete('/:id', requireRole('manager'), async (req, res) => {
  const courseId = id(req.params.id);
  const [{ n }] = await q('SELECT COUNT(*) n FROM lessons WHERE course_id=?', [courseId]);
  if (n) throw conflict('До курсу прив’язані уроки. Спершу змініть у них курс.');
  await q('DELETE FROM courses WHERE id=?', [courseId]);
  res.json({ ok: true });
});

/* Роадмап */
function parseStep(b) {
  return {
    title: str(b.title, 'Назва етапу', { max: 120 }),
    description: str(b.description, 'Опис', { max: 300, required: false }),
  };
}

coursesRouter.post('/:id/steps', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
  if (!course) throw notFound();
  const [{ next }] = await q('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM roadmap_steps WHERE course_id=?', [courseId]);
  const r = await q('INSERT INTO roadmap_steps SET ?', [{ ...parseStep(req.body ?? {}), course_id: courseId, position: next }]);
  res.status(201).json((await q('SELECT * FROM roadmap_steps WHERE id=?', [r.insertId]))[0]);
});

coursesRouter.patch('/:id/steps/:stepId', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const r = await q('UPDATE roadmap_steps SET ? WHERE id=? AND course_id=?', [
    parseStep(req.body ?? {}), id(req.params.stepId), courseId,
  ]);
  if (!r.affectedRows) throw notFound();
  res.json({ ok: true });
});

coursesRouter.delete('/:id/steps/:stepId', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  await q('DELETE FROM roadmap_steps WHERE id=? AND course_id=?', [id(req.params.stepId), courseId]);
  res.json({ ok: true });
});

coursesRouter.put('/:id/steps-order', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const ids = idList(req.body?.ids, 'Етапи');
  const existing = await q('SELECT id FROM roadmap_steps WHERE course_id=?', [courseId]);
  if (existing.length !== ids.length || !existing.every((s) => ids.includes(s.id))) {
    throw bad('Список етапів застарів. Оновіть сторінку.');
  }
  await tx(async (t) => {
    for (const [i, stepId] of ids.entries()) {
      await t('UPDATE roadmap_steps SET position=? WHERE id=?', [i + 1, stepId]);
    }
  });
  res.json({ ok: true });
});

/* ШІ-режим: чернетка з тексту, потім окремий запис уже перевіреного людиною варіанта */
const aiLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `user-${req.user.id}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Забагато запитів до ШІ. Спробуйте за годину.' },
});

coursesRouter.post('/:id/roadmap/draft', aiLimit, async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const [course] = await q('SELECT title FROM courses WHERE id=?', [courseId]);
  if (!course) throw notFound('Курс не знайдено');
  const text = str(req.body?.text, 'Текст', { max: 30000 });
  res.json({ steps: await draftRoadmap(text, course.title) });
});

coursesRouter.post('/:id/roadmap/import', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
  if (!course) throw notFound('Курс не знайдено');
  const steps = normalizeSteps(req.body?.steps);
  if (!steps.length) throw bad('Додайте хоча б один етап');
  await tx(async (t) => {
    if (req.body?.replace) await t('DELETE FROM roadmap_steps WHERE course_id=?', [courseId]);
    const [{ last }] = await t('SELECT COALESCE(MAX(position), 0) AS last FROM roadmap_steps WHERE course_id=?', [courseId]);
    for (const [i, step] of steps.entries()) {
      const r = await t('INSERT INTO roadmap_steps (course_id, position, title, description) VALUES (?,?,?,?)', [
        courseId, last + i + 1, step.title, step.description,
      ]);
      if (step.substeps.length) {
        await t('INSERT INTO roadmap_substeps (step_id, position, title) VALUES ?', [
          step.substeps.map((title, k) => [r.insertId, k + 1, title]),
        ]);
      }
    }
  });
  res.status(201).json({ ok: true, steps: steps.length });
});

async function assertStudentOnCourse(user, courseId, studentId) {
  const teacherFilter = user.role === 'teacher' ? 'AND l.teacher_id = ?' : '';
  const [onCourse] = await q(
    `SELECT 1 FROM lessons l JOIN lesson_students ls ON ls.lesson_id = l.id
      WHERE l.course_id=? AND ls.student_id=? ${teacherFilter} LIMIT 1`,
    user.role === 'teacher' ? [courseId, studentId, user.id] : [courseId, studentId]
  );
  if (!onCourse) throw forbidden('Учень не вчиться у вас на цьому курсі');
}

// Позначка етапу поширюється на всі його підпункти.
coursesRouter.put('/:id/progress', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const studentId = id(req.body?.student_id, 'Учень');
  const stepId = id(req.body?.step_id, 'Етап');
  const [step] = await q('SELECT id FROM roadmap_steps WHERE id=? AND course_id=?', [stepId, courseId]);
  if (!step) throw notFound('Етап не знайдено');
  await assertStudentOnCourse(req.user, courseId, studentId);
  await tx(async (t) => {
    if (req.body?.done) {
      await t('INSERT IGNORE INTO roadmap_progress (student_id, step_id, marked_by) VALUES (?,?,?)', [
        studentId, stepId, req.user.id,
      ]);
      await t(
        `INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by)
         SELECT ?, id, ? FROM roadmap_substeps WHERE step_id=?`,
        [studentId, req.user.id, stepId]
      );
    } else {
      await t('DELETE FROM roadmap_progress WHERE student_id=? AND step_id=?', [studentId, stepId]);
      await t(
        `DELETE p FROM roadmap_substep_progress p JOIN roadmap_substeps s ON s.id = p.substep_id
          WHERE p.student_id=? AND s.step_id=?`,
        [studentId, stepId]
      );
    }
  });
  res.json({ ok: true });
});

/* Підпункти етапу */

/** Приводить позначку етапу у відповідність до підпунктів: усі позначені — етап пройдено. */
async function syncStepDone(t, stepId, markedBy) {
  const [{ total }] = await t('SELECT COUNT(*) AS total FROM roadmap_substeps WHERE step_id=?', [stepId]);
  if (!total) return;
  await t(
    `INSERT IGNORE INTO roadmap_progress (student_id, step_id, marked_by)
     SELECT p.student_id, ?, ? FROM roadmap_substep_progress p
       JOIN roadmap_substeps s ON s.id = p.substep_id
      WHERE s.step_id=? GROUP BY p.student_id HAVING COUNT(*) = ?`,
    [stepId, markedBy, stepId, total]
  );
  await t(
    `DELETE rp FROM roadmap_progress rp
      WHERE rp.step_id=? AND (
        SELECT COUNT(*) FROM roadmap_substep_progress p
          JOIN roadmap_substeps s ON s.id = p.substep_id
         WHERE s.step_id=? AND p.student_id = rp.student_id
      ) < ?`,
    [stepId, stepId, total]
  );
}

async function loadStep(courseId, stepIdValue) {
  const [step] = await q('SELECT id FROM roadmap_steps WHERE id=? AND course_id=?', [id(stepIdValue, 'Етап'), courseId]);
  if (!step) throw notFound('Етап не знайдено');
  return step;
}
async function loadSubstep(courseId, subIdValue) {
  const [sub] = await q(
    `SELECT x.id, x.step_id FROM roadmap_substeps x JOIN roadmap_steps s ON s.id = x.step_id
      WHERE x.id=? AND s.course_id=?`,
    [id(subIdValue, 'Підпункт'), courseId]
  );
  if (!sub) throw notFound('Підпункт не знайдено');
  return sub;
}

coursesRouter.post('/:id/steps/:stepId/substeps', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const step = await loadStep(courseId, req.params.stepId);
  const title = str(req.body?.title, 'Назва підпункту', { max: 160 });
  const created = await tx(async (t) => {
    const [{ next }] = await t('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM roadmap_substeps WHERE step_id=?', [step.id]);
    const r = await t('INSERT INTO roadmap_substeps (step_id, position, title) VALUES (?,?,?)', [step.id, next, title]);
    // Хто вже пройшов етап, той не втрачає його через новий підпункт.
    await t(
      `INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by)
       SELECT student_id, ?, marked_by FROM roadmap_progress WHERE step_id=?`,
      [r.insertId, step.id]
    );
    return r.insertId;
  });
  res.status(201).json({ id: created });
});

coursesRouter.patch('/:id/substeps/:subId', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const sub = await loadSubstep(courseId, req.params.subId);
  await q('UPDATE roadmap_substeps SET title=? WHERE id=?', [str(req.body?.title, 'Назва підпункту', { max: 160 }), sub.id]);
  res.json({ ok: true });
});

coursesRouter.delete('/:id/substeps/:subId', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const sub = await loadSubstep(courseId, req.params.subId);
  await tx(async (t) => {
    await t('DELETE FROM roadmap_substeps WHERE id=?', [sub.id]);
    await syncStepDone(t, sub.step_id, req.user.id);
  });
  res.json({ ok: true });
});

coursesRouter.put('/:id/steps/:stepId/substeps-order', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const step = await loadStep(courseId, req.params.stepId);
  const ids = idList(req.body?.ids, 'Підпункти');
  const existing = await q('SELECT id FROM roadmap_substeps WHERE step_id=?', [step.id]);
  if (existing.length !== ids.length || !existing.every((s) => ids.includes(s.id))) {
    throw bad('Список підпунктів застарів. Оновіть сторінку.');
  }
  await tx(async (t) => {
    for (const [i, subId] of ids.entries()) {
      await t('UPDATE roadmap_substeps SET position=? WHERE id=?', [i + 1, subId]);
    }
  });
  res.json({ ok: true });
});

coursesRouter.put('/:id/substep-progress', async (req, res) => {
  const courseId = id(req.params.id);
  await assertEdit(req.user, courseId);
  const studentId = id(req.body?.student_id, 'Учень');
  const sub = await loadSubstep(courseId, req.body?.substep_id);
  await assertStudentOnCourse(req.user, courseId, studentId);
  await tx(async (t) => {
    if (req.body?.done) {
      await t('INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by) VALUES (?,?,?)', [
        studentId, sub.id, req.user.id,
      ]);
    } else {
      await t('DELETE FROM roadmap_substep_progress WHERE student_id=? AND substep_id=?', [studentId, sub.id]);
    }
    await syncStepDone(t, sub.step_id, req.user.id);
  });
  res.json({ ok: true });
});
