import type { Row } from '../../db.js';
import { forbidden, notFound } from '../../lib.js';
import type { User } from '../../common/auth.js';

/* Правила доступу до тестів. Окремо від запитів, щоб їх було видно одним місцем. */

/** Вчитель бачить і змінює лише власні тести; схвалений тест далі веде менеджер. */
export function assertAuthor(user: User, quiz: Row, { edit }: { edit: boolean }): void {
  if (user.role === 'manager') return;
  if (quiz.created_by !== user.id) throw notFound('Тест не знайдено');
  if (edit && quiz.status === 'approved') throw forbidden('Тест уже схвалено. Змінити його може менеджер.');
}

/** Призначення відкриває його учень або менеджер. */
export function assertOwnerOrManager(user: User, assignment: Row): void {
  if (user.role === 'manager' || (user.role === 'student' && assignment.student_id === user.id)) return;
  throw forbidden();
}

/** Тест менеджера одразу в загальному списку, тест вчителя чекає на схвалення. */
export const initialStatus = (user: User) => (user.role === 'manager' ? 'approved' : 'pending');

/** Після правки вчителем тест знову йде на модерацію; менеджер статус не змінює. */
export const statusAfterEdit = (user: User, current: string) => (user.role === 'manager' ? current : 'pending');
