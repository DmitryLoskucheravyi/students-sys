import test from 'node:test';
import assert from 'node:assert/strict';
import { dedent, highlight, splitCode } from '../../client/src/codeHighlight.js';
import { QUIZ_PROMPT, parseQuizAnswer } from '../../client/src/quizImport.js';

test('промпт просить обгортати код у ^^', () => {
  assert.match(QUIZ_PROMPT, /\^\^console\.log\(1\)\^\^/);
  assert.match(QUIZ_PROMPT, /Багаторядковий код/);
});

test('багаторядковий код у питанні зберігає переноси й відступи, рядки коду не стають варіантами', () => {
  const r = parseQuizAnswer(`Назва: Код

? Що виведе цей код?
^^
function sum(a, b) {
  return a + b;
}
console.log(sum(2, 3));
^^
+ ^^5^^
- ^^"23"^^
- ^^undefined^^`);
  assert.equal(r.questions.length, 1);
  const q = r.questions[0];
  assert.equal(q.options.length, 3);
  assert.deepEqual(q.options.map((o) => o.text), ['^^5^^', '^^"23"^^', '^^undefined^^']);
  assert.ok(q.options[0].correct);
  const [text, code] = splitCode(q.text);
  assert.equal(text.text.trim(), 'Що виведе цей код?');
  assert.equal(code.code, true);
  assert.equal(code.text, 'function sum(a, b) {\n  return a + b;\n}\nconsole.log(sum(2, 3));');
});

test('код в одному рядку питання лишається плашкою, текст навколо стискається', () => {
  const r = parseQuizAnswer(`? Що   поверне ^^typeof   null^^ у JS?
+ object
- null
- undefined`);
  assert.equal(r.questions[0].text, 'Що поверне ^^typeof   null^^ у JS?');
  const parts = splitCode(r.questions[0].text);
  assert.deepEqual(parts.map((p) => p.code), [false, true, false]);
});

test('dedent прибирає спільний відступ і порожні рядки по краях', () => {
  assert.equal(dedent('\n    a\n      b\n\n'), 'a\n  b');
});

test('підсвічування: ключові слова, рядки, числа, коментарі, виклики, типи', () => {
  const tokens = highlight('const x = Math.max(1, 2); // ok\nif (x) return "a";');
  const cls = (t) => tokens.find(([, text]) => text === t)?.[0];
  assert.equal(cls('const'), 'hl-keyword');
  assert.equal(cls('if'), 'hl-control');
  assert.equal(cls('return'), 'hl-control');
  assert.equal(cls('Math'), 'hl-type');
  assert.equal(cls('max'), 'hl-function');
  assert.equal(cls('1'), 'hl-number');
  assert.equal(cls('"a"'), 'hl-string');
  assert.equal(cls('// ok'), 'hl-comment');
  assert.equal(tokens.map(([, t]) => t).join(''), 'const x = Math.max(1, 2); // ok\nif (x) return "a";');
});

test('підсвічування HTML: тег, атрибут, значення', () => {
  const tokens = highlight('<a href="/">Go</a>');
  const cls = (t) => tokens.find(([, text]) => text === t)?.[0];
  assert.equal(cls('a'), 'hl-tag');
  assert.equal(cls('href'), 'hl-attr');
  assert.equal(cls('"/"'), 'hl-attr-value');
  assert.equal(tokens.map(([, t]) => t).join(''), '<a href="/">Go</a>');
});

test('підсвічування Python: коментар через # і def', () => {
  const tokens = highlight('def f():\n    # note\n    return None');
  const cls = (t) => tokens.find(([, text]) => text === t)?.[0];
  assert.equal(cls('def'), 'hl-keyword');
  assert.equal(cls('# note'), 'hl-comment');
  assert.equal(cls('None'), 'hl-keyword');
});
