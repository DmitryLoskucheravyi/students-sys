import { bad, dateTime, id, str } from '../../lib.js';

/* Розбір даних тесту з форми: чисті функції, лише перевірка й нормалізація. */

export const MAX_QUESTIONS = 40;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;
export const MAX_QUESTION_LENGTH = 2000;
export const IMAGE_NAME = /^[0-9a-f-]{36}\.bin$/;

export interface OptionInput { id: number | null; text: string; correct: boolean }
export interface QuestionInput { id: number | null; text: string; image: string | null; options: OptionInput[] }
export interface QuizInput { title: string; description: string | null; questions: QuestionInput[] }

export function parseQuiz(b: any): QuizInput {
  const title = str(b?.title, 'Назва тесту', { max: 160 });
  const description = str(b?.description, 'Опис', { max: 1000, required: false });
  const raw = b?.questions;
  if (!Array.isArray(raw) || !raw.length) throw bad('Додайте хоча б одне питання');
  if (raw.length > MAX_QUESTIONS) throw bad(`Максимум ${MAX_QUESTIONS} питань`);
  const questions = raw.map((x: any, i: number): QuestionInput => {
    const n = `Питання ${i + 1}`;
    const text = str(x?.text, `${n}: текст`, { max: MAX_QUESTION_LENGTH });
    const image = x?.image ? String(x.image) : null;
    if (image && !IMAGE_NAME.test(image)) throw bad(`${n}: картинку не знайдено`);
    const opts = Array.isArray(x?.options) ? x.options : [];
    if (opts.length < MIN_OPTIONS || opts.length > MAX_OPTIONS) throw bad(`${n}: потрібно від ${MIN_OPTIONS} до ${MAX_OPTIONS} варіантів`);
    const options = opts.map((o: any, k: number): OptionInput => ({
      id: o?.id ? id(o.id, 'Варіант') : null,
      text: str(o?.text, `${n}, варіант ${k + 1}`, { max: 200 }),
      correct: o?.correct === true,
    }));
    const texts = options.map((o: OptionInput) => o.text.toLowerCase());
    if (new Set(texts).size !== texts.length) throw bad(`${n}: варіанти повторюються`);
    if (!options.some((o: OptionInput) => o.correct)) throw bad(`${n}: позначте хоча б одну правильну відповідь`);
    return { id: x?.id ? id(x.id, 'Питання') : null, text, image, options };
  });
  return { title, description, questions };
}

/** Новий тест: усі питання й варіанти без id, щоб записались як нові. */
export const asNew = (questions: QuestionInput[]): QuestionInput[] =>
  questions.map((x) => ({ ...x, id: null, options: x.options.map((o) => ({ ...o, id: null })) }));

/** Курс і термін призначення. Наявність курсу перевіряє репозиторій. */
export function parseAssignmentInput(b: any): { courseId: number | null; dueAt: string | null } {
  return {
    courseId: b?.course_id ? id(b.course_id, 'Курс') : null,
    dueAt: b?.due_at ? dateTime(b.due_at, 'Пройти до') : null,
  };
}
