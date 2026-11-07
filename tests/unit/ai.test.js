import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { MAX_STEPS, MAX_SUBSTEPS, draftRoadmap, normalizeSteps } from '../../server/ai.js';

const realFetch = globalThis.fetch;
const realError = console.error;
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODELS;
});

const answer = (steps) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ steps }) }] } }] }), { status: 200 });

function stubGemini(handler) {
  process.env.GEMINI_API_KEY = 'k';
  process.env.GEMINI_MODELS = 'a,b';
  console.error = () => {};
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, calls.length);
  };
  return calls;
}

test('normalizeSteps прибирає порожнє й тримає межі таблиць', () => {
  const steps = normalizeSteps([
    { title: '  Етап  ', description: '', substeps: [' a ', '', 42, null] },
    { title: '   ', substeps: ['x'] },
    { title: 'д'.repeat(500), description: 'о'.repeat(500), substeps: 'не масив' },
    null,
  ]);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[0], { title: 'Етап', description: null, substeps: ['a'] });
  assert.equal(steps[1].title.length, 120);
  assert.equal(steps[1].description.length, 300);
  assert.deepEqual(steps[1].substeps, []);
});

test('normalizeSteps обмежує кількість етапів і підпунктів', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ title: `e${i}`, substeps: Array.from({ length: 100 }, (__, k) => `s${k}`) }));
  const steps = normalizeSteps(many);
  assert.equal(steps.length, MAX_STEPS);
  assert.equal(steps[0].substeps.length, MAX_SUBSTEPS);
  assert.deepEqual(normalizeSteps('рядок'), []);
});

test('без ключа дає зрозумілу помилку і не ходить у мережу', async () => {
  const calls = [];
  globalThis.fetch = async () => { calls.push(1); };
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 503 && e.message.includes('GEMINI_API_KEY'));
  assert.equal(calls.length, 0);
});

test('ключ іде в заголовку, а не в адресі', async () => {
  const calls = stubGemini(() => answer([{ title: 'A', substeps: [] }]));
  await draftRoadmap('t', 'c');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'k');
  assert.ok(!String(calls[0].url).includes('k='));
});

test('після ліміту першої моделі пробує наступну', async () => {
  const calls = stubGemini((_, n) => (n === 1 ? new Response('{}', { status: 429 }) : answer([{ title: 'A', substeps: [] }])));
  const steps = await draftRoadmap('t', 'c');
  assert.equal(calls.length, 2);
  assert.equal(steps[0].title, 'A');
});

test('усі моделі в ліміті: 429 із поясненням', async () => {
  stubGemini(() => new Response('{}', { status: 429 }));
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 429 && e.message.includes('ліміт'));
});

test('відхилений ключ не перебирає моделі', async () => {
  const calls = stubGemini(() => new Response('{}', { status: 403 }));
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 503 && e.message.includes('GEMINI_API_KEY'));
  assert.equal(calls.length, 1);
});

test('обрив мережі: пробує наступну модель і повідомляє про недоступність', async () => {
  const calls = stubGemini(() => { throw new TypeError('network'); });
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 503 && e.message.includes('недоступний'));
  assert.equal(calls.length, 2);
});

test('обрізана відповідь і порожній результат дають різні зрозумілі помилки', async () => {
  stubGemini(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"steps": [' }] } }] })));
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 502);
  stubGemini(() => answer([]));
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 422);
  stubGemini(() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })));
  await assert.rejects(draftRoadmap('t', 'c'), (e) => e.status === 422);
});

test('normalizeQuestions лишає лише питання з 3-6 різними варіантами й правильною відповіддю', async () => {
  const { normalizeQuestions, MAX_OPTIONS } = await import('../../server/ai.js');
  const opts = (n, correct = [0]) => Array.from({ length: n }, (_, i) => ({ text: `v${i}`, correct: correct.includes(i) }));
  const out = normalizeQuestions([
    { text: ' Добре ', options: opts(4, [0, 2]) },
    { text: 'Мало варіантів', options: opts(2) },
    { text: 'Без правильної', options: opts(4, []) },
    { text: 'Повтори', options: [{ text: 'a', correct: true }, { text: 'A', correct: false }, { text: 'b' }] },
    { text: 'Багато', options: opts(9) },
    { text: '', options: opts(3) },
    null,
  ]);
  assert.deepEqual(out.map((x) => x.text), ['Добре', 'Багато']);
  assert.equal(out[0].options.filter((o) => o.correct).length, 2);
  assert.equal(out[1].options.length, MAX_OPTIONS);
  assert.deepEqual(normalizeQuestions('ні'), []);
});