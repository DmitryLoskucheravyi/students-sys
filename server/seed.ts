// Демо-дані для локального перегляду. Запускається лише на порожній базі.
import bcrypt from 'bcryptjs';
import { ensureDatabase } from './setup.js';
import { addDays, addMinutes, today, weekdayOf } from './lib.js';

await ensureDatabase();
const { q } = await import('./db.js');
const { ensureSessions } = await import('./schedule.js');

const [{ n }] = await q(`SELECT COUNT(*) n FROM users WHERE role<>'manager'`);
if (n > 0) {
  console.log('У базі вже є користувачі. Демо-дані не додано.');
  process.exit(0);
}

const user = async (role: string, name: string, login: string, password: string, phone: string | null = null): Promise<number> => {
  const r = await q('INSERT INTO users (role, name, login, password_hash, phone) VALUES (?,?,?,?,?)', [
    role, name, login, await bcrypt.hash(password, 10), phone,
  ]);
  return r.insertId;
};

const teacher = await user('teacher', 'Олена Коваль', 'teacher', 'teacher123', '+380 67 111 22 33');
const teacher2 = await user('teacher', 'Андрій Мельник', 'melnyk', 'teacher123');
const student = await user('student', 'Марко Шевчук', 'student', 'student123', '+380 50 123 45 67');
const s2 = await user('student', 'Дарина Бойко', 'boiko', 'student123');
const s3 = await user('student', 'Ілля Ткаченко', 'tkachenko', 'student123');

const course = async (title: string, summary: string, steps: [string, string][]): Promise<number> => {
  const r = await q('INSERT INTO courses (title, summary) VALUES (?,?)', [title, summary]);
  for (const [i, [t, d]] of steps.entries()) {
    await q('INSERT INTO roadmap_steps (course_id, position, title, description) VALUES (?,?,?,?)', [r.insertId, i + 1, t, d]);
  }
  return r.insertId;
};
const web = await course('Веброзробка', 'Від першої сторінки до власного застосунку', [
  ['HTML і структура', 'Семантика, форми, таблиці'],
  ['CSS і верстка', 'Flexbox, Grid, адаптивність'],
  ['JavaScript', 'Змінні, функції, DOM'],
  ['Git', 'Коміти, гілки, GitHub'],
  ['React', 'Компоненти, стан, ефекти'],
  ['Власний проєкт', 'Застосунок від ідеї до деплою'],
]);
const py = await course('Python', 'Основи програмування й автоматизація', [
  ['Синтаксис', 'Типи, умови, цикли'],
  ['Функції та модулі', 'Параметри, імпорти, файли'],
  ['ООП', 'Класи та спадкування'],
  ['Фінальний бот', 'Telegram-бот із базою даних'],
]);

await q(`UPDATE courses SET icon='web', theme='web' WHERE id=?`, [web]);
await q(`UPDATE courses SET icon='py', theme='snake' WHERE id=?`, [py]);

const plan = async (name: string, count: number, price: number, days: number): Promise<number> =>
  (await q('INSERT INTO plans (name, lessons_count, price_per_lesson, valid_days) VALUES (?,?,?,?)', [name, count, price, days])).insertId;
const p4 = await plan('Старт', 4, 450, 30);
const p8 = await plan('Базовий', 8, 400, 45);
await plan('Річний ритм', 24, 340, 120);

const d = today();
const sub = (studentId: number, planId: number, name: string, total: number, used: number, price: number, days: number) =>
  q(
    `INSERT INTO subscriptions (student_id, plan_id, name, lessons_total, lessons_used, price_per_lesson, starts_on, expires_on)
     VALUES (?,?,?,?,?,?,?,?)`,
    [studentId, planId, name, total, used, price, addDays(d, -14), addDays(d, days)]
  );
await sub(student, p8, 'Базовий', 8, 1, 380, 31);
await sub(s2, p4, 'Старт', 4, 3, 450, 16);
await sub(s3, p8, 'Базовий', 8, 2, 400, 31);

// Уроки — шаблони. Вчитель і учні з'являються лише в постановці в розклад.
const lesson = async (title: string, courseId: number, minutes: number, location: string): Promise<number> =>
  (await q('INSERT INTO lessons (title, course_id, duration_min, location) VALUES (?,?,?,?)', [title, courseId, minutes, location])).insertId;
const webGroup = await lesson('Веб: група А', web, 90, 'Кабінет 2');
const pyOne = await lesson('Python індивідуально', py, 60, 'https://zoom.us/j/1234567890');
const webOne = await lesson('Веб: консультація', web, 45, 'https://meet.google.com/abc-defg-hij');

const roster = (scheduleId: number, students: number[]) =>
  q('INSERT INTO schedule_students (schedule_id, student_id) VALUES ?', [students.map((s) => [scheduleId, s])]);
const monday = addDays(d, 1 - weekdayOf(d));
const weekly = async (lessonId: number, teacherId: number, days: number[], time: string, students: number[]): Promise<number> => {
  const r = await q(
    `INSERT INTO lesson_schedules (lesson_id, teacher_id, kind, weekday, weekdays, start_time, start_date) VALUES (?, ?, 'weekly', ?, ?, ?, ?)`,
    [lessonId, teacherId, days[0], days.join(','), time, addDays(monday, -7)]
  );
  await roster(r.insertId, students);
  return r.insertId;
};
const webGroupSchedule = await weekly(webGroup, teacher, [1, 4], '17:00', [student, s2]);
const pySchedule = await weekly(pyOne, teacher2, [3], '15:30', [student]);
await ensureSessions(addDays(d, 35));

const r = await q(`INSERT INTO lesson_schedules (lesson_id, teacher_id, kind, start_time, start_date) VALUES (?, ?, 'once', '12:00', ?)`, [
  webOne, teacher, addDays(monday, 5),
]);
await roster(r.insertId, [s3]);
const onceStart = `${addDays(monday, 5)} 12:00:00`;
await q('INSERT INTO lesson_sessions (lesson_id, schedule_id, original_starts_at, starts_at, ends_at) VALUES (?,?,?,?,?)', [
  webOne, r.insertId, onceStart, onceStart, addMinutes(onceStart, 45),
]);

// Підпункти: перші два етапи вебкурсу пройдено повністю, третій частково.
const addSubs = async (stepId: number, titles: string[]): Promise<number[]> => {
  const ids: number[] = [];
  for (const [i, title] of titles.entries()) {
    ids.push((await q('INSERT INTO roadmap_substeps (step_id, position, title) VALUES (?,?,?)', [stepId, i + 1, title])).insertId);
  }
  return ids;
};
const markSubs = async (ids: number[]) => {
  for (const subId of ids) {
    await q('INSERT INTO roadmap_substep_progress (student_id, substep_id, marked_by) VALUES (?,?,?)', [student, subId, teacher]);
  }
};
const webSteps = await q('SELECT id FROM roadmap_steps WHERE course_id=? ORDER BY position', [web]);
await markSubs(await addSubs(webSteps[0].id, ['Теги та атрибути', 'Форми', 'Таблиці']));
await markSubs(await addSubs(webSteps[1].id, ['Селектори', 'Flexbox', 'Grid', 'Медіазапити']));
await markSubs((await addSubs(webSteps[2].id, ['Змінні та типи', 'Функції', 'Масиви й об’єкти', 'Робота з DOM', 'Події'])).slice(0, 2));
await addSubs(webSteps[4].id, ['Компоненти й пропси', 'Стан', 'Ефекти']);
for (const s of webSteps.slice(0, 2)) {
  await q('INSERT INTO roadmap_progress (student_id, step_id, marked_by) VALUES (?,?,?)', [student, s.id, teacher]);
}

await q('INSERT INTO homework (lesson_id, schedule_id, title, description, due_at, created_by) VALUES (?,?,?,?,?,?)', [
  webGroup, webGroupSchedule, 'Адаптивна картка профілю',
  'Зверстайте картку за макетом. Здайте папку проєкту архівом і скрін мобільної версії. Макет: https://www.figma.com/community',
  `${addDays(d, 4)} 23:59:00`, teacher,
]);
await q('INSERT INTO homework (lesson_id, schedule_id, title, description, due_at, created_by) VALUES (?,?,?,?,?,?)', [
  pyOne, pySchedule, 'Калькулятор у консолі', 'Чотири дії та обробка ділення на нуль.', `${addDays(d, 6)} 20:00:00`, teacher2,
]);

// Тест, відкритий Маркові й прив'язаний до теми React на роадмапі.
const quiz = (await q('INSERT INTO quizzes (title, description, created_by) VALUES (?,?,?)', [
  'React: основи', 'Короткий тест після уроку про компоненти.', null,
])).insertId;
const question = async (position: number, text: string, options: [string, boolean][]) => {
  const qid = (await q('INSERT INTO quiz_questions (quiz_id, position, text) VALUES (?,?,?)', [quiz, position, text])).insertId;
  for (const [i, [t, ok]] of options.entries()) {
    await q('INSERT INTO quiz_options (question_id, position, text, is_correct) VALUES (?,?,?,?)', [qid, i + 1, t, ok ? 1 : 0]);
  }
};
await question(1, 'Що повертає компонент React?', [['Розмітку JSX', true], ['CSS-файл', false], ['SQL-запит', false]]);
await question(2, 'Які хуки керують станом?', [['useState', true], ['useReducer', true], ['useEffect', false], ['useRef', false]]);
await question(3, 'Як передати дані в дочірній компонент?', [['Через пропси', true], ['Через localStorage', false], ['Через CSS', false]]);
await q('INSERT INTO quiz_assignments (quiz_id, student_id, course_id, due_at) VALUES (?,?,?,?)', [
  quiz, student, web, `${addDays(d, 5)} 20:00:00`,
]);

console.log(`Готово. Входи:
  менеджер  manager / manager123
  вчитель   teacher / teacher123
  учень     student / student123`);
process.exit(0);
