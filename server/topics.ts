import { q, type Query, type Row } from './db.js';
import { bad, id } from './lib.js';

/* Теми роадмапу, до яких прив'язують домашнє чи тест: етап цілком або окремий підпункт. */

export interface Topic { step_id: number; substep_id: number | null }
export interface CourseStep { id: number; title: string; substeps: { id: number; title: string }[] }

export async function courseTopics(courseId: number): Promise<CourseStep[]> {
  const steps: Row[] = await q('SELECT id, title FROM roadmap_steps WHERE course_id=? ORDER BY position, id', [courseId]);
  const subs = steps.length
    ? await q('SELECT id, step_id, title FROM roadmap_substeps WHERE step_id IN (?) ORDER BY position, id', [steps.map((s) => s.id)]) as Row[]
    : [];
  return steps.map((s) => ({ id: s.id, title: s.title, substeps: subs.filter((x: Row) => x.step_id === s.id).map(({ id: subId, title }: Row) => ({ id: subId, title })) }));
}

/**
 * Приводить список тем до чистого вигляду: лише теми цього курсу, без повторів.
 * Обраний цілий етап поглинає свої підпункти.
 */
export async function parseTopics(raw: unknown, courseId: number | null | undefined): Promise<Topic[]> {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw bad('Теми передано неправильно');
  if (raw.length > 200) throw bad('Забагато тем');
  if (!raw.length) return [];
  if (!courseId) throw bad('Оберіть курс, щоб прив’язати теми');
  const steps = await courseTopics(courseId);
  const whole = new Set<number>();
  const parts = new Map<number, number>();
  for (const t of raw as Row[]) {
    const stepId = id(t?.step_id, 'Тема');
    const step = steps.find((s) => s.id === stepId);
    if (!step) throw bad('Тема не з цього курсу');
    if (t.substep_id == null || t.substep_id === '') {
      whole.add(stepId);
      continue;
    }
    const subId = id(t.substep_id, 'Підтема');
    if (!step.substeps.some((x) => x.id === subId)) throw bad('Підтема не з цієї теми');
    parts.set(subId, stepId);
  }
  return [
    ...[...whole].map((stepId) => ({ step_id: stepId, substep_id: null })),
    ...[...parts].filter(([, stepId]) => !whole.has(stepId)).map(([subId, stepId]) => ({ step_id: stepId, substep_id: subId })),
  ];
}

/** Перезаписує теми запису в таблиці table, де owner — колонка власника (homework_id чи assignment_id). */
export async function saveTopics(t: Query, table: string, owner: string, ownerId: number, topics: Topic[]): Promise<void> {
  await t(`DELETE FROM ${table} WHERE ${owner}=?`, [ownerId]);
  if (topics.length) {
    await t(`INSERT INTO ${table} (${owner}, step_id, substep_id) VALUES ?`, [topics.map((x) => [ownerId, x.step_id, x.substep_id])]);
  }
}

export async function topicsOf(table: string, owner: string, ownerId: number): Promise<Row[]> {
  return q(
    `SELECT t.step_id, t.substep_id, s.title AS step_title, x.title AS substep_title
       FROM ${table} t JOIN roadmap_steps s ON s.id = t.step_id
       LEFT JOIN roadmap_substeps x ON x.id = t.substep_id
      WHERE t.${owner}=? ORDER BY s.position, s.id, x.position, x.id`,
    [ownerId]
  );
}
