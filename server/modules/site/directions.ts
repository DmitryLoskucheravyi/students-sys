/*
 * Напрямки сайту: чисті функції без бази — розбір форми менеджера і складання напрямку з його курсів.
 * Покриті тестами в tests/unit/directions.test.js.
 */
import type { Row } from '../../db.js';
import { bad, idList, str } from '../../lib.js';

export type DirectionInput = {
  row: { title: string; summary: string | null; is_published: 0 | 1 };
  courseIds: number[];
};

/** Форма напрямку: назва, опис, чи показувати, курси по черзі (дублікати прибираються, порядок — як передали). */
export function parseDirection(b: any): DirectionInput {
  return {
    row: {
      title: str(b.title, 'Назва', { max: 120 }),
      summary: str(b.summary, 'Опис', { max: 600, required: false }),
      is_published: b.is_published === false || b.is_published === 0 ? 0 : 1,
    },
    courseIds: idList(b.course_ids ?? [], 'Курси'),
  };
}

/**
 * Напрямок разом із його курсами. all — курси кількох напрямків одним списком (поле direction_id),
 * уже впорядковані. Іконка й колір напрямку — від першого курсу; теми — сума тем усіх курсів.
 */
export function withCourses(d: Row, all: Row[]): Row {
  const courses: Row[] = all
    .filter((c) => c.direction_id === d.id)
    .map(({ direction_id: _d, ...c }) => ({ ...c, steps: Number(c.steps) || 0 }));
  return {
    ...d,
    icon: courses[0]?.icon ?? null,
    theme: courses[0]?.theme ?? null,
    steps: courses.reduce((n: number, c: Row) => n + c.steps, 0),
    courses,
  };
}

/** Новий порядок напрямків має містити рівно всі наявні напрямки — інакше позиції перемішаються. */
export function checkOrder(ids: number[], existing: number[]): void {
  const have = new Set(existing);
  if (ids.length !== have.size || ids.some((x) => !have.has(x))) throw bad('Порядок має містити всі напрямки');
}
