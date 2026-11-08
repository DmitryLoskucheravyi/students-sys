/* Спільне для сторінок тестів. */
import { plural } from '../../fmt.js';

/** Перерахувати лічильник сповіщень у навігації. */
export const notify = () => window.dispatchEvent(new Event('bs:notify'));
export const questionsWord = (n) => `${n} ${plural(n, 'питання', 'питання', 'питань')}`;
export const imageUrl = (name) => `/api/quizzes/images/${name}`;
