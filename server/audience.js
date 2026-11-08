/*
 * Кому видно домашнє. Фрагменти SQL приймають вирази (назви колонок або числа),
 * а не параметри «?», тому їх можна вкладати в будь-який запит без підрахунку плейсхолдерів.
 *
 * Домашнє буває двох видів:
 *  - до уроку: h.course_id порожній, отримують учні постановки h.schedule_id;
 *  - до теми роадмапу: h.course_id заданий, отримують учні курсу.
 *    Якщо h.teacher_id заданий (домашнє задав вчитель), лише його учні на цьому курсі.
 */

/** Число для вставки в SQL: лише ціле, інакше помилка. */
export function sqlInt(v) {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`Не ціле число в SQL: ${v}`);
  return String(n);
}

/** Учень st вчиться на курсі course: у постановці уроку курсу або доданий напряму. teacher — фільтр за вчителем або NULL. */
export const IN_COURSE = (course, teacher, st) => `(
  EXISTS (SELECT 1 FROM lessons l JOIN lesson_schedules sc ON sc.lesson_id = l.id
            JOIN schedule_students ss ON ss.schedule_id = sc.id
           WHERE l.course_id = ${course} AND l.is_active = 1 AND sc.is_active = 1 AND ss.student_id = ${st}
             AND (${teacher} IS NULL OR sc.teacher_id = ${teacher}))
  OR EXISTS (SELECT 1 FROM course_students cs
              WHERE cs.course_id = ${course} AND cs.student_id = ${st}
                AND (${teacher} IS NULL OR cs.teacher_id = ${teacher})))`;

/** Вчитель t веде курс course: стоїть у постановці його уроку або закріплений за учнем курсу. */
export const TEACHES = (course, t) => `(
  EXISTS (SELECT 1 FROM lessons l JOIN lesson_schedules sc ON sc.lesson_id = l.id
           WHERE l.course_id = ${course} AND sc.teacher_id = ${t} AND sc.is_active = 1 AND l.is_active = 1)
  OR EXISTS (SELECT 1 FROM course_students cs WHERE cs.course_id = ${course} AND cs.teacher_id = ${t}))`;

/** Домашнє h задано учню st. */
export const HW_FOR = (h, st) => `(
  (${h}.course_id IS NULL AND EXISTS (SELECT 1 FROM schedule_students ss WHERE ss.schedule_id = ${h}.schedule_id AND ss.student_id = ${st}))
  OR (${h}.course_id IS NOT NULL AND ${IN_COURSE(`${h}.course_id`, `${h}.teacher_id`, st)}))`;

/**
 * Вчитель t бачить домашнє h: веде постановку уроку, задав його сам
 * або домашнє задав менеджер на курсі, який він веде (тоді вчитель бачить лише своїх учнів).
 * sc — псевдонім постановки домашнього (LEFT JOIN).
 */
export const HW_STAFF = (h, sc, t) => `(
  (${h}.course_id IS NULL AND ${sc}.teacher_id = ${t})
  OR (${h}.course_id IS NOT NULL AND (${h}.teacher_id = ${t} OR (${h}.teacher_id IS NULL AND ${TEACHES(`${h}.course_id`, t)}))))`;
