import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coursesWord, desktopProgress, directionMeta, homePlans, initials, mobileProgress, peekReady, shownCount, stackPos, ticketClass, topicsWord,
} from '../../client/src/site/logic.js';

test('слова з числами', () => {
  assert.equal(topicsWord(1), '1 тема');
  assert.equal(topicsWord(3), '3 теми');
  assert.equal(topicsWord(11), '11 тем');
  assert.equal(coursesWord(2), '2 курси');
  assert.equal(coursesWord(5), '5 курсів');
});

test('ініціали: зайві пробіли, одне слово, порожньо', () => {
  assert.equal(initials('Тато  Тест Тестович'), 'ТТ');
  assert.equal(initials('  олена '), 'О');
  assert.equal(initials(''), '');
  assert.equal(initials(null), '');
});

test('колір квитка: невідомий — червоний', () => {
  assert.equal(ticketClass('violet'), 'tk-violet');
  assert.equal(ticketClass('purple'), 'tk-red');
  assert.equal(ticketClass(undefined), 'tk-red');
});

test('підпис напрямку', () => {
  assert.equal(directionMeta({ courses: [{}], steps: 4 }), '4 теми');
  assert.equal(directionMeta({ courses: [{}, {}], steps: 10 }), '2 курси, 10 тем');
  assert.equal(directionMeta({ courses: [{}], steps: 0 }), '');
});

test('ціни на головній: 1, 3, 5 або 2, 3, 4; менше п\'яти — перші три', () => {
  const p = [1, 2, 3, 4, 5];
  assert.deepEqual(homePlans(p, { wide: false, alt: true }), [1, 3, 5]);
  assert.deepEqual(homePlans(p, { wide: true, alt: false }), [1, 3, 5]);
  assert.deepEqual(homePlans(p, { wide: true, alt: true }), [2, 3, 4]);
  assert.deepEqual(homePlans([1, 2, 3, 4], { wide: true, alt: true }), [1, 2, 3]);
  assert.deepEqual(homePlans([], { wide: false }), []);
});

test('місце в стопці по колу', () => {
  assert.deepEqual([0, 1, 2].map((k) => stackPos(k, 0, 3)), [0, 1, 2]);
  assert.deepEqual([0, 1, 2].map((k) => stackPos(k, 2, 3)), [1, 2, 0]);
});

test('роадмап, компʼютер: при заході нічого, після всієї прокрутки — усе, монотонно', () => {
  const at = (scrolled) => desktopProgress({ heroTop: 76 - scrolled, heroHeight: 824 + 900, vh: 900, head: 76 });
  assert.equal(shownCount(at(0), 8, { wide: true }), 0);
  assert.equal(shownCount(at(900), 8, { wide: true }), 8);
  let prev = 0;
  for (let s = 0; s <= 900; s += 10) {
    const n = shownCount(at(s), 8, { wide: true });
    assert.ok(n >= prev, `монотонно на ${s}`);
    prev = n;
  }
});

test('роадмап, телефон: «Старт» одразу, решта з прокруткою', () => {
  const at = (scrollY) => mobileProgress({ roadmapBottom: 950 - scrollY, scrollY, vh: 844 });
  assert.equal(shownCount(at(0), 8, { wide: false }), 1);
  assert.ok(shownCount(at(250), 8, { wide: false }) < 8);
  assert.equal(shownCount(at(600), 8, { wide: false }), 8);
  // Роадмап уже вище середини екрана (високий екран) — усе відкрито
  assert.equal(mobileProgress({ roadmapBottom: 300, scrollY: 0, vh: 900 }), 1);
});

test('шторка: кнопка в кадрі і на своєму місці', () => {
  const base = { panelBottom: 1500, buttonTop: 700, buttonBottom: 754, vh: 800 };
  assert.equal(peekReady({ ...base, wide: true }), true);
  assert.equal(peekReady({ ...base, wide: false }), false, 'телефон: кнопка ще прилипла внизу');
  assert.equal(peekReady({ ...base, wide: false, panelBottom: 780 }), true);
  assert.equal(peekReady({ ...base, wide: true, buttonBottom: 820 }), false, 'кнопка обрізана знизу');
});
