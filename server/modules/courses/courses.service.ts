import { Injectable } from '@nestjs/common';
import { type Query, type Row, q, tx } from '../../db.js';
import { draftRoadmap, normalizeSteps } from '../../ai.js';
import { bad, conflict, forbidden, id, idList, notFound, str } from '../../lib.js';
import { HW_FOR, HW_STAFF, sqlInt } from '../../audience.js';
import { saveTopics } from '../../topics.js';
import type { User } from '../../common/auth.js';

/*
 * Хто вчиться на курсі: учні постановок уроків цього курсу та учні, додані на курс напряму.
 * Хто веде: вчитель такої постановки або вчитель, закріплений за учнем курсу.
 * Кожен фрагмент чекає параметри в порядку: курс, людина.
 */
const TAUGHT = (c: string) => `(EXISTS (SELECT 1 FROM lessons l JOIN lesson_schedules sc ON sc.lesson_id = l.id
                         WHERE l.course_id = ${c} AND sc.teacher_id = ? AND sc.is_active = 1 AND l.is_active = 1)
                    OR EXISTS (SELECT 1 FROM course_students cs WHERE cs.course_id = ${c} AND cs.teacher_id = ?))`;
const STUDIED = (c: string) => `(EXISTS (SELECT 1 FROM lessons l JOIN lesson_schedules sc ON sc.lesson_id = l.id
                          JOIN schedule_students ss ON ss.schedule_id = sc.id
                         WHERE l.course_id = ${c} AND ss.student_id = ?)
                     OR EXISTS (SELECT 1 FROM course_students cs WHERE cs.course_id = ${c} AND cs.student_id = ?))`;

/** Дизайни острівця. Має збігатися з ISLAND_DESIGNS у client/src/island3d.js. */
export const ISLAND_DESIGNS = ['terminal', 'server', 'rocket', 'code', 'git'];

/** Вчитель редагує роадмап лише курсів, які сам веде. */
async function canEdit(user: User, courseId: number): Promise<boolean> {
  if (user.role === 'manager') return true;
  if (user.role !== 'teacher') return false;
  const [{ hit }] = await q(`SELECT ${TAUGHT('?')} AS hit`, [courseId, user.id, courseId, user.id]);
  return Boolean(hit);
}
async function assertEdit(user: User, courseId: number): Promise<void> {
  if (!(await canEdit(user, courseId))) throw forbidden('Цей курс веде інший вчитель');
}
async function canView(user: User, courseId: number): Promise<boolean> {
  if (user.role === 'manager') return true;
  if (user.role === 'teacher') return canEdit(user, courseId);
  const [{ hit }] = await q(`SELECT ${STUDIED('?')} AS hit`, [courseId, user.id, courseId, user.id]);
  return Boolean(hit);
}

interface CourseStudent {
  id: number; name: string; avatar?: string | null; from_schedule: boolean; direct: boolean;
  teacher_id: number | null; teacher_name: string | null; added_at?: string;
}

/** Учні курсу з позначкою, звідки вони: з розкладу, додані напряму або обидва. Вчитель бачить лише своїх. */
async function courseStudents(user: User, courseId: number): Promise<CourseStudent[]> {
  const teacher = user.role === 'teacher';
  const fromSchedule: Row[] = await q(
    `SELECT DISTINCT u.id, u.name, u.avatar FROM users u
       JOIN schedule_students ss ON ss.student_id = u.id
       JOIN lesson_schedules sc ON sc.id = ss.schedule_id
       JOIN lessons l ON l.id = sc.lesson_id
      WHERE l.course_id = ? AND l.is_active = 1 AND sc.is_active = 1 ${teacher ? 'AND sc.teacher_id = ?' : ''}`,
    teacher ? [courseId, user.id] : [courseId]
  );
  const direct: Row[] = await q(
    `SELECT u.id, u.name, u.avatar, cs.teacher_id, t.name AS teacher_name, cs.created_at AS added_at
       FROM course_students cs JOIN users u ON u.id = cs.student_id
       LEFT JOIN users t ON t.id = cs.teacher_id
      WHERE cs.course_id = ? ${teacher ? 'AND cs.teacher_id = ?' : ''}`,
    teacher ? [courseId, user.id] : [courseId]
  );
  const byId = new Map<number, CourseStudent>();
  for (const s of fromSchedule) byId.set(s.id, { id: s.id, name: s.name, avatar: s.avatar, from_schedule: true, direct: false, teacher_id: null, teacher_name: null });
  for (const s of direct) {
    const row = byId.get(s.id) ?? { id: s.id, name: s.name, avatar: s.avatar, from_schedule: false };
    byId.set(s.id, { ...row, direct: true, teacher_id: s.teacher_id, teacher_name: s.teacher_name, added_at: s.added_at });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}

/** Тести, відкриті учням курсу й прив'язані до його тем. Кожен запис належить одному учневі. */
async function courseQuizzes(courseId: number, studentIds: number[]) {
  if (!studentIds.length) return [];
  const rows: Row[] = await q(
    `SELECT a.id, a.quiz_id, a.student_id, a.due_at, a.submitted_at, a.score, a.max_score, z.title, t.step_id, t.substep_id
       FROM quiz_assignment_topics t
       JOIN quiz_assignments a ON a.id = t.assignment_id
       JOIN quizzes z ON z.id = a.quiz_id
       JOIN roadmap_steps s ON s.id = t.step_id
      WHERE s.course_id = ? AND a.student_id IN (?)
      ORDER BY a.created_at, a.id, t.id`,
    [courseId, studentIds]
  );
  const list = new Map<number, Row>();
  for (const r of rows) {
    const item = list.get(r.id) ?? {
      id: r.id, quiz_id: r.quiz_id, student_id: r.student_id, title: r.title, due_at: r.due_at,
      submitted_at: r.submitted_at, score: r.score, max_score: r.max_score, topics: [],
    };
    item.topics.push({ step_id: r.step_id, substep_id: r.substep_id });
    list.set(r.id, item);
  }
  return [...list.values()];
}

/**
 * Домашні, прив'язані до тем курсу: до уроку чи прямо до теми. Учень бачить лише задані йому, вчитель лише свої.
 * Для кожного: теми, кому задано і стан здачі кожного з переглядуваних учнів.
 */
async function courseHomework(user: User, courseId: number, studentIds: number[]) {
  const { role, id: me } = user;
  const filter = role === 'teacher' ? `AND ${HW_STAFF('h', 'sc', sqlInt(me))}` : role === 'student' ? `AND ${HW_FOR('h', sqlInt(me))}` : '';
  const rows: Row[] = await q(
    `SELECT h.id, h.title, h.due_at, t.step_id, t.substep_id
       FROM homework_topics t
       JOIN homework h ON h.id = t.homework_id
       JOIN roadmap_steps s ON s.id = t.step_id
       LEFT JOIN lesson_schedules sc ON sc.id = h.schedule_id
      WHERE s.course_id = ? ${filter}
      ORDER BY h.due_at, h.id, t.id`,
    [courseId]
  );
  if (!rows.length) return [];
  const list = new Map<number, Row>();
  for (const r of rows) {
    const hw = list.get(r.id) ?? { id: r.id, title: r.title, due_at: r.due_at, topics: [], student_ids: [], results: [] };
    hw.topics.push({ step_id: r.step_id, substep_id: r.substep_id });
    list.set(r.id, hw);
  }
  const all = [...list.values()];
  // Кому з переглядуваних учнів задано кожне домашнє: за тим самим правилом, що й у списку завдань.
  const roster: Row[] = studentIds.length
    ? await q(
        `SELECT h.id AS homework_id, u.id AS student_id FROM homework h JOIN users u ON u.id IN (?)
          WHERE h.id IN (?) AND ${HW_FOR('h', 'u.id')}`,
        [studentIds, all.map((h) => h.id)]
      )
    : [];
  const subs: Row[] = studentIds.length
    ? await q('SELECT homework_id, student_id, status, grade FROM submissions WHERE homework_id IN (?) AND student_id IN (?)', [all.map((h) => h.id), studentIds])
    : [];
  for (const h of all) {
    h.student_ids = roster.filter((r) => r.homework_id === h.id).map((r) => r.student_id);
    // Хто вибув із групи, але встиг здати, теж має бачити свою роботу.
    for (const s of subs) if (s.homework_id === h.id && !h.student_ids.includes(s.student_id)) h.student_ids.push(s.student_id);
    h.results = subs.filter((s) => s.homework_id === h.id).map(({ student_id, status, grade }) => ({ student_id, status, grade }));
  }
  return all;
}

// Набори мають збігатися з client/src/courseLook.jsx.
const COURSE_ICONS = ['roadmap', 'code', 'ts', 'js', 'py', 'web', 'blocks', 'terminal', 'db', 'mobile', 'game', 'ai',
  'git', 'php', 'sql', 'next', 'react', 'node', 'java', 'cs', 'cpp', 'css', 'docker', 'cloud', 'api', 'security', 'data', 'design'];
const COURSE_THEMES = ['school', 'typed', 'script', 'snake', 'web', 'git', 'php', 'sql', 'next'];
function pick(v: unknown, list: string[], label: string): string | null {
  if (v == null || v === '') return null;
  if (!list.includes(v as string)) throw bad(`${label}: оберіть зі списку`);
  return v as string;
}
const parseLook = (b: any) => ({ icon: pick(b.icon, COURSE_ICONS, 'Іконка'), theme: pick(b.theme, COURSE_THEMES, 'Тема') });

async function assertPerson(userId: number, role: string, label: string) {
  const [u] = await q('SELECT id FROM users WHERE id=? AND role=? AND is_active=1', [userId, role]);
  if (!u) throw bad(`${label} не знайдено`);
}

function parseStep(b: any) {
  return {
    title: str(b.title, 'Назва етапу', { max: 120 }),
    description: str(b.description, 'Опис', { max: 300, required: false }),
  };
}

/** Приводить позначку етапу у відповідність до підпунктів: усі позначені — етап пройдено. */
async function syncStepDone(t: Query, stepId: number, markedBy: number) {
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

async function loadStep(courseId: number, stepIdValue: unknown): Promise<Row> {
  const [step] = await q('SELECT id FROM roadmap_steps WHERE id=? AND course_id=?', [id(stepIdValue, 'Етап'), courseId]);
  if (!step) throw notFound('Етап не знайдено');
  return step;
}
async function loadSubstep(courseId: number, subIdValue: unknown): Promise<Row> {
  const [sub] = await q(
    `SELECT x.id, x.step_id FROM roadmap_substeps x JOIN roadmap_steps s ON s.id = x.step_id
      WHERE x.id=? AND s.course_id=?`,
    [id(subIdValue, 'Підпункт'), courseId]
  );
  if (!sub) throw notFound('Підпункт не знайдено');
  return sub;
}

async function assertStudentOnCourse(user: User, courseId: number, studentId: number) {
  const onCourse = (await courseStudents(user, courseId)).some((s) => s.id === studentId);
  if (!onCourse) throw forbidden('Учень не вчиться у вас на цьому курсі');
}

/** Нові позиції за списком id. Список має збігатися з наявними записами, інакше клієнт бачив застарілі дані. */
async function reorder(table: string, existing: Row[], ids: number[], stale: string) {
  if (existing.length !== ids.length || !existing.every((s) => ids.includes(s.id))) throw bad(stale);
  await tx(async (t) => {
    for (const [i, rowId] of ids.entries()) await t(`UPDATE ${table} SET position=? WHERE id=?`, [i + 1, rowId]);
  });
}

/** Курси, їхні учні та роадмап: етапи, підпункти й позначки проходження. */
@Injectable()
export class CoursesService {
  list(user: User) {
    const { role, id: me } = user;
    const scope = role === 'manager' ? '' : `WHERE ${(role === 'teacher' ? TAUGHT : STUDIED)('c.id')}`;
    return q(
      `SELECT c.*,
          (SELECT COUNT(*) FROM roadmap_steps s WHERE s.course_id = c.id) AS steps_count,
          (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = c.id)
          + (SELECT COUNT(DISTINCT ss.student_id) FROM lessons l
               JOIN lesson_schedules sc ON sc.lesson_id = l.id
               JOIN schedule_students ss ON ss.schedule_id = sc.id
              WHERE l.course_id = c.id AND l.is_active = 1 AND sc.is_active = 1
                AND NOT EXISTS (SELECT 1 FROM course_students cs WHERE cs.course_id = c.id AND cs.student_id = ss.student_id)
            ) AS students_count,
          (SELECT COUNT(*) FROM roadmap_progress p JOIN roadmap_steps s ON s.id = p.step_id
            WHERE s.course_id = c.id AND p.student_id = ?) AS my_done
         FROM courses c ${scope} ORDER BY c.title`,
      role === 'manager' ? [me] : [me, me, me]
    );
  }

  async create(body: any) {
    const b = body ?? {};
    const look = parseLook(b);
    const r = await q('INSERT INTO courses (title, summary, icon, theme) VALUES (?,?,?,?)', [
      str(b.title, 'Назва', { max: 120 }),
      str(b.summary, 'Опис', { max: 300, required: false }),
      look.icon,
      look.theme,
    ]);
    return (await q('SELECT * FROM courses WHERE id=?', [r.insertId]))[0];
  }

  async detail(user: User, idValue: unknown) {
    const courseId = id(idValue);
    const [course] = await q('SELECT * FROM courses WHERE id=?', [courseId]);
    if (!course) throw notFound('Курс не знайдено');
    if (!(await canView(user, courseId))) throw forbidden();

    const steps: Row[] = await q('SELECT * FROM roadmap_steps WHERE course_id=? ORDER BY position, id', [courseId]);
    const isStudent = user.role === 'student';

    // Учень бачить лише власний прогрес і не бачить інших учнів курсу.
    const students = isStudent ? [] : await courseStudents(user, courseId);
    const ids = isStudent ? [user.id] : students.map((s) => s.id);
    const homework = await courseHomework(user, courseId, ids);
    const quizzes = await courseQuizzes(courseId, ids);
    const progress = ids.length && steps.length
      ? await q(
          `SELECT p.student_id, p.step_id, p.done_at FROM roadmap_progress p
            WHERE p.student_id IN (?) AND p.step_id IN (?)`,
          [ids, steps.map((s) => s.id)]
        )
      : [];
    const substeps: Row[] = steps.length
      ? await q('SELECT * FROM roadmap_substeps WHERE step_id IN (?) ORDER BY position, id', [steps.map((s) => s.id)])
      : [];
    const subProgress = ids.length && substeps.length
      ? await q(
          'SELECT student_id, substep_id FROM roadmap_substep_progress WHERE student_id IN (?) AND substep_id IN (?)',
          [ids, substeps.map((s) => s.id)]
        )
      : [];
    // Учень бачить лише острівці зі схваленими тестами.
    const islands: Row[] = await q(
      `SELECT i.step_id, i.design, i.quiz_id, z.title AS quiz_title, z.status AS quiz_status,
              (SELECT COUNT(*) FROM quiz_questions x WHERE x.quiz_id = z.id) AS questions_count
         FROM course_islands i JOIN roadmap_steps s ON s.id = i.step_id JOIN quizzes z ON z.id = i.quiz_id
        WHERE s.course_id = ? ${isStudent ? "AND z.status = 'approved'" : ''}`,
      [courseId]
    );
    return {
      ...course,
      islands,
      steps: steps.map((s) => ({ ...s, substeps: substeps.filter((x) => x.step_id === s.id) })),
      students,
      progress,
      sub_progress: subProgress,
      homework,
      quizzes,
      can_edit: await canEdit(user, courseId),
    };
  }

  /* Острівці: тестування на місці номера етапу */
  private async stepOf(courseId: number, stepValue: unknown): Promise<Row> {
    const [step] = await q('SELECT * FROM roadmap_steps WHERE id=? AND course_id=?', [id(stepValue, 'Етап'), courseId]);
    if (!step) throw notFound('Етап не знайдено');
    return step;
  }

  async setIsland(user: User, idValue: unknown, stepValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const step = await this.stepOf(courseId, stepValue);
    const design = String(body?.design ?? 'terminal');
    if (!ISLAND_DESIGNS.includes(design)) throw bad('Невідомий дизайн острівця');
    const quizId = id(body?.quiz_id, 'Тест');
    const [quiz] = await q('SELECT id, status, created_by FROM quizzes WHERE id=?', [quizId]);
    // Вчитель ставить схвалений тест або власний, що ще на модерації.
    if (!quiz || (user.role !== 'manager' && quiz.status !== 'approved' && quiz.created_by !== user.id)) throw bad('Тест не знайдено');
    if (quiz.status === 'rejected') throw bad('Тест відхилено на модерації. Виправте його й надішліть знову.');
    await q(
      `INSERT INTO course_islands (step_id, quiz_id, design, created_by) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE quiz_id=VALUES(quiz_id), design=VALUES(design)`,
      [step.id, quizId, design, user.id]
    );
    return { ok: true };
  }

  async removeIsland(user: User, idValue: unknown, stepValue: unknown) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const step = await this.stepOf(courseId, stepValue);
    const r = await q('DELETE FROM course_islands WHERE step_id=?', [step.id]);
    if (!r.affectedRows) throw notFound('Острівця немає');
    return { ok: true };
  }

  /**
   * Учень натискає острівець: тест відкривається йому з цього курсу, якщо ще не відкритий.
   * Тема тесту — попередній етап: острівець перевіряє пройдене перед ним.
   */
  async startIsland(user: User, idValue: unknown, stepValue: unknown) {
    const courseId = id(idValue);
    if (!(await canView(user, courseId))) throw forbidden();
    const step = await this.stepOf(courseId, stepValue);
    const [island] = await q(
      `SELECT i.quiz_id FROM course_islands i JOIN quizzes z ON z.id = i.quiz_id WHERE i.step_id=? AND z.status='approved'`,
      [step.id]
    );
    if (!island) throw notFound('Тестування ще не готове');
    const [have] = await q('SELECT id FROM quiz_assignments WHERE quiz_id=? AND student_id=?', [island.quiz_id, user.id]);
    if (have) return { id: have.id };
    const [prev] = await q(
      'SELECT id FROM roadmap_steps WHERE course_id=? AND (position < ? OR (position = ? AND id < ?)) ORDER BY position DESC, id DESC LIMIT 1',
      [courseId, step.position, step.position, step.id]
    );
    const aid = await tx(async (t) => {
      const r = await t('INSERT INTO quiz_assignments (quiz_id, student_id, course_id, assigned_by) VALUES (?,?,?,NULL)', [island.quiz_id, user.id, courseId]);
      await saveTopics(t, 'quiz_assignment_topics', 'assignment_id', r.insertId, [{ step_id: prev?.id ?? step.id, substep_id: null }]);
      return r.insertId as number;
    });
    return { id: aid };
  }

  /* Учні курсу напряму: додає й прибирає менеджер */
  async addStudent(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    if (!course) throw notFound('Курс не знайдено');
    const studentId = id(body?.student_id, 'Учень');
    const teacherId = body?.teacher_id ? id(body.teacher_id, 'Вчитель') : null;
    await assertPerson(studentId, 'student', 'Учня');
    if (teacherId) await assertPerson(teacherId, 'teacher', 'Вчителя');
    const [exists] = await q('SELECT 1 FROM course_students WHERE course_id=? AND student_id=?', [courseId, studentId]);
    if (exists) throw conflict('Учень уже на цьому курсі');
    await q('INSERT INTO course_students (course_id, student_id, teacher_id, added_by) VALUES (?,?,?,?)', [
      courseId, studentId, teacherId, user.id,
    ]);
    return { ok: true };
  }

  async setStudentTeacher(idValue: unknown, studentValue: unknown, body: any) {
    const courseId = id(idValue);
    const teacherId = body?.teacher_id ? id(body.teacher_id, 'Вчитель') : null;
    if (teacherId) await assertPerson(teacherId, 'teacher', 'Вчителя');
    const r = await q('UPDATE course_students SET teacher_id=? WHERE course_id=? AND student_id=?', [
      teacherId, courseId, id(studentValue),
    ]);
    if (!r.affectedRows) throw notFound('Учня на курсі не знайдено');
    return { ok: true };
  }

  /** Прогрес лишається: якщо учня повернуть на курс, позначки відновляться. */
  async removeStudent(idValue: unknown, studentValue: unknown) {
    const r = await q('DELETE FROM course_students WHERE course_id=? AND student_id=?', [id(idValue), id(studentValue)]);
    if (!r.affectedRows) throw notFound('Учня на курсі не знайдено');
    return { ok: true };
  }

  async update(idValue: unknown, body: any) {
    const courseId = id(idValue);
    const b = body ?? {};
    const fields = [str(b.title, 'Назва', { max: 120 }), str(b.summary, 'Опис', { max: 300, required: false })];
    // Старі клієнти не надсилають вигляд курсу: тоді його не чіпаємо.
    const hasLook = 'icon' in b || 'theme' in b;
    const look = parseLook(b);
    const r = hasLook
      ? await q('UPDATE courses SET title=?, summary=?, icon=?, theme=? WHERE id=?', [...fields, look.icon, look.theme, courseId])
      : await q('UPDATE courses SET title=?, summary=? WHERE id=?', [...fields, courseId]);
    if (!r.affectedRows) throw notFound();
    return { ok: true };
  }

  async remove(idValue: unknown) {
    const courseId = id(idValue);
    const [{ n }] = await q('SELECT COUNT(*) n FROM lessons WHERE course_id=?', [courseId]);
    if (n) throw conflict('До курсу прив’язані уроки. Спершу змініть у них курс.');
    await q('DELETE FROM courses WHERE id=?', [courseId]);
    return { ok: true };
  }

  /* Роадмап */
  async addStep(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    if (!course) throw notFound();
    const [{ next }] = await q('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM roadmap_steps WHERE course_id=?', [courseId]);
    const r = await q('INSERT INTO roadmap_steps SET ?', [{ ...parseStep(body ?? {}), course_id: courseId, position: next }]);
    return (await q('SELECT * FROM roadmap_steps WHERE id=?', [r.insertId]))[0];
  }

  async updateStep(user: User, idValue: unknown, stepValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const r = await q('UPDATE roadmap_steps SET ? WHERE id=? AND course_id=?', [parseStep(body ?? {}), id(stepValue), courseId]);
    if (!r.affectedRows) throw notFound();
    return { ok: true };
  }

  async removeStep(user: User, idValue: unknown, stepValue: unknown) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    await q('DELETE FROM roadmap_steps WHERE id=? AND course_id=?', [id(stepValue), courseId]);
    return { ok: true };
  }

  async orderSteps(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const ids = idList(body?.ids, 'Етапи');
    const existing: Row[] = await q('SELECT id FROM roadmap_steps WHERE course_id=?', [courseId]);
    await reorder('roadmap_steps', existing, ids, 'Список етапів застарів. Оновіть сторінку.');
    return { ok: true };
  }

  /* ШІ-режим: чернетка з тексту, потім окремий запис уже перевіреного людиною варіанта */
  async draft(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const [course] = await q('SELECT title FROM courses WHERE id=?', [courseId]);
    if (!course) throw notFound('Курс не знайдено');
    const text = str(body?.text, 'Текст', { max: 30000 });
    return { steps: await draftRoadmap(text, course.title) };
  }

  async importSteps(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const [course] = await q('SELECT id FROM courses WHERE id=?', [courseId]);
    if (!course) throw notFound('Курс не знайдено');
    const steps = normalizeSteps(body?.steps);
    if (!steps.length) throw bad('Додайте хоча б один етап');
    await tx(async (t) => {
      if (body?.replace) await t('DELETE FROM roadmap_steps WHERE course_id=?', [courseId]);
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
    return { ok: true, steps: steps.length };
  }

  /** Позначка етапу поширюється на всі його підпункти. */
  async setProgress(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const studentId = id(body?.student_id, 'Учень');
    const stepId = id(body?.step_id, 'Етап');
    const [step] = await q('SELECT id FROM roadmap_steps WHERE id=? AND course_id=?', [stepId, courseId]);
    if (!step) throw notFound('Етап не знайдено');
    await assertStudentOnCourse(user, courseId, studentId);
    await tx(async (t) => {
      if (body?.done) {
        await t('INSERT IGNORE INTO roadmap_progress (student_id, step_id, marked_by) VALUES (?,?,?)', [studentId, stepId, user.id]);
        await t(
          `INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by)
           SELECT ?, id, ? FROM roadmap_substeps WHERE step_id=?`,
          [studentId, user.id, stepId]
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
    return { ok: true };
  }

  /* Підпункти етапу */
  async addSubstep(user: User, idValue: unknown, stepValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const step = await loadStep(courseId, stepValue);
    const title = str(body?.title, 'Назва підпункту', { max: 160 });
    const created = await tx(async (t) => {
      const [{ next }] = await t('SELECT COALESCE(MAX(position), 0) + 1 AS next FROM roadmap_substeps WHERE step_id=?', [step.id]);
      const r = await t('INSERT INTO roadmap_substeps (step_id, position, title) VALUES (?,?,?)', [step.id, next, title]);
      // Хто вже пройшов етап, той не втрачає його через новий підпункт.
      await t(
        `INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by)
         SELECT student_id, ?, marked_by FROM roadmap_progress WHERE step_id=?`,
        [r.insertId, step.id]
      );
      return r.insertId as number;
    });
    return { id: created };
  }

  async renameSubstep(user: User, idValue: unknown, subValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const sub = await loadSubstep(courseId, subValue);
    await q('UPDATE roadmap_substeps SET title=? WHERE id=?', [str(body?.title, 'Назва підпункту', { max: 160 }), sub.id]);
    return { ok: true };
  }

  async removeSubstep(user: User, idValue: unknown, subValue: unknown) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const sub = await loadSubstep(courseId, subValue);
    await tx(async (t) => {
      await t('DELETE FROM roadmap_substeps WHERE id=?', [sub.id]);
      await syncStepDone(t, sub.step_id, user.id);
    });
    return { ok: true };
  }

  async orderSubsteps(user: User, idValue: unknown, stepValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const step = await loadStep(courseId, stepValue);
    const ids = idList(body?.ids, 'Підпункти');
    const existing: Row[] = await q('SELECT id FROM roadmap_substeps WHERE step_id=?', [step.id]);
    await reorder('roadmap_substeps', existing, ids, 'Список підпунктів застарів. Оновіть сторінку.');
    return { ok: true };
  }

  async setSubstepProgress(user: User, idValue: unknown, body: any) {
    const courseId = id(idValue);
    await assertEdit(user, courseId);
    const studentId = id(body?.student_id, 'Учень');
    const sub = await loadSubstep(courseId, body?.substep_id);
    await assertStudentOnCourse(user, courseId, studentId);
    await tx(async (t) => {
      if (body?.done) {
        await t('INSERT IGNORE INTO roadmap_substep_progress (student_id, substep_id, marked_by) VALUES (?,?,?)', [studentId, sub.id, user.id]);
      } else {
        await t('DELETE FROM roadmap_substep_progress WHERE student_id=? AND substep_id=?', [studentId, sub.id]);
      }
      await syncStepDone(t, sub.step_id, user.id);
    });
    return { ok: true };
  }
}
