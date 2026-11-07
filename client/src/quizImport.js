/*
 * Тест із відповіді зовнішнього ШІ. Менеджер копіює промпт, сам іде в будь-який чат зі ШІ,
 * а відповідь вставляє назад. Тут вона розбирається на питання й варіанти для редактора.
 * Модуль без React: його перевіряють юніт-тести.
 */
export const MAX_QUESTIONS = 40;
export const MIN_OPTIONS = 3;
export const MAX_OPTIONS = 6;

export const QUIZ_PROMPT = `Склади тест для перевірки знань учня за матеріалом, який я надішлю в кінці цього повідомлення.

Відповідай лише самим тестом у форматі нижче, без вступу, пояснень і markdown:

Назва: коротка назва тесту

? Текст першого питання
+ правильний варіант
- неправильний варіант
- неправильний варіант
- неправильний варіант

? Текст другого питання
+ правильний варіант
+ ще один правильний варіант
- неправильний варіант

Правила формату:
- Перший рядок «Назва: ...».
- Кожне питання з нового рядка, починається з «? ».
- Кожен варіант з нового рядка: «+ » для правильного, «- » для неправильного.
- У кожному питанні від 3 до 6 варіантів. Правильних один або кілька.
- Питання до 500 символів, варіант до 200 символів.
- Не більше ${MAX_QUESTIONS} питань. Між питаннями порожній рядок.
- Не нумеруй питання й варіанти, не додавай емодзі.
- Неправильні варіанти мають бути правдоподібними.

Матеріал:
`;

const clean = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');
/** Зняти markdown-обгортки: **жирний**, `код` по краях, нумерацію «1.» чи «а)». */
const unwrap = (s) => s.replace(/^\*\*(.*)\*\*$/, '$1').replace(/^__(.*)__$/, '$1').trim();

const TITLE = /^(?:назва(?:\s+тесту)?|тест|title)\s*[:：]\s*(.+)$/i;
const QUESTION = /^(?:\?|❓|(?:питання|q|question)?\s*\d{1,2}\s*[.):]|(?:питання|q|question)\s*[:.])\s*(.+)$/i;
// Після «+» чи «-» обов'язковий пробіл, щоб варіант «-1» не став неправильним «1».
const OPTION = /^(?:([+\-–—*•])\s+|(✅|✔️?|✓|❌|✗|\[\s*[xх✓✔]?\s*\])\s*)(.+)$/iu;
const isCorrectMark = (m) => /^(\+|✅|✔️?|✓|\[\s*[xх✓✔]\s*\])$/iu.test(m);

function fromJson(text) {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  let data;
  try { data = JSON.parse(text.slice(start, Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1)); } catch { return null; }
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list)) return null;
  return {
    title: Array.isArray(data) ? '' : clean(data.title, 160),
    raw: list.map((q) => ({
      text: q?.text ?? q?.question ?? '',
      options: (q?.options ?? q?.answers ?? []).map((o) => (typeof o === 'string'
        ? { text: o, correct: false }
        : { text: o?.text ?? '', correct: o?.correct === true || o?.is_correct === true || o?.isCorrect === true })),
    })),
  };
}

function fromLines(text) {
  let title = '';
  const raw = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const s = unwrap(line.trim());
    if (!s || /^```/.test(s) || /^(?:-{3,}|\*{3,})$/.test(s)) continue;
    let m;
    if (!cur && !title && (m = s.match(TITLE))) { title = unwrap(m[1]); continue; }
    if ((m = s.match(OPTION)) && cur) {
      cur.options.push({ text: unwrap(m[3]), correct: isCorrectMark(m[1] ?? m[2]) });
      continue;
    }
    if ((m = s.match(QUESTION))) {
      cur = { text: unwrap(m[1]), options: [] };
      raw.push(cur);
      continue;
    }
    // Продовження тексту питання, поки варіантів ще немає.
    if (cur && !cur.options.length) cur.text += ` ${s}`;
  }
  return { title: clean(title, 160), raw };
}

/**
 * Розбирає вставлену відповідь. Повертає назву (якщо була), придатні питання
 * й пропущені з причиною, щоб менеджер знав, що виправити.
 */
export function parseQuizAnswer(text) {
  const src = typeof text === 'string' ? text.trim() : '';
  if (!src) return { title: '', questions: [], skipped: [] };
  const parsed = (/^(```\w*\s*)?[[{]/.test(src) && fromJson(src.replace(/^```\w*\s*/, ''))) || fromLines(src);
  const questions = [];
  const skipped = [];
  parsed.raw.forEach((q, i) => {
    const n = i + 1;
    const qtext = clean(q.text, 500);
    const seen = new Set();
    const options = q.options.flatMap((o) => {
      const t = clean(o.text, 200);
      if (!t || seen.has(t.toLowerCase())) return [];
      seen.add(t.toLowerCase());
      return [{ text: t, correct: Boolean(o.correct) }];
    });
    let reason = null;
    if (!qtext) reason = 'немає тексту питання';
    else if (options.length < MIN_OPTIONS) reason = `варіантів ${options.length}, треба щонайменше ${MIN_OPTIONS}`;
    else if (options.length > MAX_OPTIONS) reason = `варіантів ${options.length}, можна не більше ${MAX_OPTIONS}`;
    else if (!options.some((o) => o.correct)) reason = 'не позначено правильну відповідь';
    else if (questions.length >= MAX_QUESTIONS) reason = `у тесті не більше ${MAX_QUESTIONS} питань`;
    if (reason) skipped.push({ n, text: qtext, reason });
    else questions.push({ text: qtext, options });
  });
  return { title: parsed.title, questions, skipped };
}
