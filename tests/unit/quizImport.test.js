import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_OPTIONS, QUIZ_PROMPT, parseQuizAnswer } from '../../client/src/quizImport.js';

test('розбирає формат із промпту: назва, кілька правильних, продовження рядка', () => {
  const r = parseQuizAnswer(`Ось ваш тест:

Назва: **JavaScript: типи**

? Що повертає typeof null?
+ "object"
- "null"
- "undefined"

? Які значення хибні
в JavaScript?
+ 0
+ ""
- "0"
- []`);
  assert.equal(r.title, 'JavaScript: типи');
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[1].text, 'Які значення хибні в JavaScript?');
  assert.deepEqual(r.questions[1].options.map((o) => o.correct), [true, true, false, false]);
  assert.deepEqual(r.skipped, []);
});

test('пропускає непридатні питання з причиною', () => {
  const opts = Array.from({ length: MAX_OPTIONS + 1 }, (_, i) => `- v${i}`).join('\n');
  const r = parseQuizAnswer(`? Мало\n+ так\n- ні\n\n? Без правильної\n- a\n- b\n- c\n\n? Багато\n+ ok\n${opts}\n\n? Повтори\n+ a\n- A\n- b\n- c`);
  assert.deepEqual(r.questions.map((q) => q.text), ['Повтори']);
  assert.equal(r.questions[0].options.length, 3);
  assert.deepEqual(r.skipped.map((s) => s.n), [1, 2, 3]);
  assert.match(r.skipped[0].reason, /щонайменше 3/);
  assert.match(r.skipped[1].reason, /правильну/);
  assert.match(r.skipped[2].reason, /не більше 6/);
});

test('розуміє нумерацію, чекбокси й «-1» як текст варіанта', () => {
  const r = parseQuizAnswer(`1. Скільки буде 2 - 3?\n[x] -1\n[ ] 1\n[ ] 5\n\nПитання 2: Столиця України?\n✅ Київ\n❌ Львів\n- Одеса`);
  assert.equal(r.questions.length, 2);
  assert.equal(r.questions[0].options[0].text, '-1');
  assert.equal(r.questions[0].options[0].correct, true);
  assert.deepEqual(r.questions[1].options.map((o) => o.correct), [true, false, false]);
});

test('приймає JSON, зокрема в блоці коду', () => {
  const r = parseQuizAnswer('```json\n{"title":"T","questions":[{"question":"Q","answers":[{"text":"a","correct":true},{"text":"b"},{"text":"c","is_correct":false}]}]}\n```');
  assert.equal(r.title, 'T');
  assert.equal(r.questions[0].text, 'Q');
  assert.deepEqual(r.questions[0].options.map((o) => o.correct), [true, false, false]);
});

test('порожній чи сторонній текст не дає питань, промпт описує формат', () => {
  assert.deepEqual(parseQuizAnswer('').questions, []);
  assert.deepEqual(parseQuizAnswer('Вибачте, я не можу допомогти.').questions, []);
  assert.match(QUIZ_PROMPT, /\? Текст першого питання/);
  assert.match(QUIZ_PROMPT, /«\+ » для правильного/);
});

test('позначки загубились під час копіювання з чату: питання й варіанти все одно розставлені', () => {
  const r = parseQuizAnswer(`Назва: Основи JavaScript

? Яке ключове слово оголошує незмінну змінну?

const
let
var
static

? Які з наведених типів є примітивними в JavaScript?

string
boolean
object
array

? Що поверне typeof null?
“object”
“null”
“undefined”`);
  assert.equal(r.title, 'Основи JavaScript');
  assert.equal(r.questions.length, 3);
  assert.equal(r.unmarked, 3);
  assert.equal(r.questions[0].text, 'Яке ключове слово оголошує незмінну змінну?');
  assert.deepEqual(r.questions[0].options.map((o) => o.text), ['const', 'let', 'var', 'static']);
  assert.ok(r.questions.every((q) => q.options.every((o) => !o.correct)));
  assert.equal(r.questions[2].options.length, 3);
  assert.deepEqual(r.skipped, []);
});

test('промпт просить блок коду, а позначені варіанти з блоку розбираються як завжди', () => {
  assert.match(QUIZ_PROMPT, /```text/);
  const r = parseQuizAnswer('```text\nНазва: X\n\n? Q?\n\n+ a\n- b\n- c\n```');
  assert.equal(r.unmarked, 0);
  assert.deepEqual(r.questions[0].options.map((o) => o.correct), [true, false, false]);
});
