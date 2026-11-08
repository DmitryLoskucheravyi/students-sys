import { bad, id } from '../../lib.js';

/*
 * Оцінювання тесту: чисті функції без бази й побічних ефектів.
 * Однакові для проходження учнем і для тесту за публічним посиланням.
 */

export interface LoadedOption { id: number; text: string; correct?: boolean }
export interface LoadedQuestion { id: number; text: string; image: string | null; multiple: boolean; options: LoadedOption[] }
export interface Pick { question_id: number; option_id: number }

/** Питання зараховано, якщо обрано рівно всі правильні варіанти. */
export function isRight(question: LoadedQuestion, chosen: Pick[]): boolean {
  const picked = new Set(chosen.filter((c) => c.question_id === question.id).map((c) => c.option_id));
  const correct = question.options.filter((o) => o.correct).map((o) => o.id);
  return picked.size === correct.length && correct.every((oid) => picked.has(oid));
}

/** Розбирає відповіді { [questionId]: optionId[] } і рахує бал. Питання мають бути з правильними відповідями. */
export function grade(questions: LoadedQuestion[], raw: unknown): { picks: Pick[]; score: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad('Відповіді передано неправильно');
  const answers = raw as Record<string, unknown>;
  const picks = questions.flatMap((x) => {
    const list = answers[x.id] ?? [];
    if (!Array.isArray(list)) throw bad('Відповіді передано неправильно');
    const ids = [...new Set(list.map((v: unknown) => id(v, 'Варіант')))];
    if (ids.some((oid) => !x.options.some((o) => o.id === oid))) throw bad('Варіант не з цього питання');
    if (!x.multiple && ids.length > 1) throw bad('У цьому питанні лише одна правильна відповідь');
    return ids.map((oid) => ({ question_id: x.id, option_id: oid }));
  });
  return { picks, score: questions.filter((x) => isRight(x, picks)).length };
}

/** Питання для розбору після здачі: що обрано й чи правильно. */
export const withMarks = (questions: LoadedQuestion[], picks: Pick[], { marks = true } = {}) =>
  questions.map((x) => ({
    ...x,
    chosen: picks.filter((c) => c.question_id === x.id).map((c) => c.option_id),
    ...(marks ? { right: isRight(x, picks) } : {}),
  }));
