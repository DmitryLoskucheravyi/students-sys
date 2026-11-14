import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkOrder, parseDirection, withCourses } from '../../server/modules/site/directions.js';

test('форма напрямку: назва обовʼязкова, дублікати курсів прибрано, порядок збережено', () => {
  const d = parseDirection({ title: '  Програмування з нуля ', summary: '', course_ids: [3, 1, 3, '2'] });
  assert.equal(d.row.title, 'Програмування з нуля');
  assert.equal(d.row.summary, null);
  assert.equal(d.row.is_published, 1);
  assert.deepEqual(d.courseIds, [3, 1, 2]);
  assert.throws(() => parseDirection({ title: '' }), /Назва/);
  assert.throws(() => parseDirection({ title: 'x', course_ids: 'abc' }), /список/);
  assert.throws(() => parseDirection({ title: 'x', course_ids: [-1] }));
  assert.equal(parseDirection({ title: 'x', is_published: false }).row.is_published, 0);
  assert.throws(() => parseDirection({ title: 'x'.repeat(121) }));
});

test('напрямок із курсами: вигляд від першого, теми — сума, чужі курси не потрапляють', () => {
  const all = [
    { direction_id: 1, id: 10, title: 'Python', icon: 'snake', theme: 'snake', steps: '4' },
    { direction_id: 2, id: 11, title: 'Git', icon: 'git', theme: 'git', steps: 2 },
    { direction_id: 1, id: 12, title: 'Веб', icon: 'web', theme: 'web', steps: 6 },
  ];
  const d = withCourses({ id: 1, title: 'З нуля' }, all);
  assert.equal(d.icon, 'snake');
  assert.equal(d.theme, 'snake');
  assert.equal(d.steps, 10);
  assert.deepEqual(d.courses.map((c) => c.id), [10, 12]);
  assert.ok(!('direction_id' in d.courses[0]));
  const empty = withCourses({ id: 3, title: 'Порожній' }, all);
  assert.deepEqual([empty.icon, empty.theme, empty.steps, empty.courses.length], [null, null, 0, 0]);
});

test('порядок напрямків — рівно всі наявні', () => {
  assert.doesNotThrow(() => checkOrder([3, 1, 2], [1, 2, 3]));
  assert.throws(() => checkOrder([1, 2], [1, 2, 3]), /всі напрямки/);
  assert.throws(() => checkOrder([1, 2, 4], [1, 2, 3]), /всі напрямки/);
  assert.doesNotThrow(() => checkOrder([], []));
});
