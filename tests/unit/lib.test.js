import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addMinutes, dateTime, hhmm, id, idList, int, isoDate, money, normalizePhone, str, weekdayOf } from '../../server/lib.js';

const rejects = (fn) => assert.throws(fn, (e) => e.status === 400);

test('дата: приймає реальні дні в розумних межах', () => {
  assert.equal(isoDate('2026-02-28'), '2026-02-28');
  assert.equal(isoDate('2028-02-29'), '2028-02-29');
  for (const bad of ['2026-02-30', '2026-13-01', '9999-12-31', '0000-01-01', '26-1-1', '', null, 5]) rejects(() => isoDate(bad));
});

test('час: межі доби', () => {
  assert.equal(hhmm('00:00'), '00:00');
  assert.equal(hhmm('23:59'), '23:59');
  for (const bad of ['24:00', '12:60', '9:00']) rejects(() => hhmm(bad));
});

test('дата й час нормалізуються до секунд', () => {
  assert.equal(dateTime('2026-11-06 23:30'), '2026-11-06 23:30:00');
  rejects(() => dateTime('not-a-date'));
});

test('addMinutes переходить через північ, місяць і рік', () => {
  assert.equal(addMinutes('2026-11-06 23:30:00', 90), '2026-11-07 01:00:00');
  assert.equal(addMinutes('2026-12-31 23:50:00', 20), '2027-01-01 00:10:00');
});

test('addDays і день тижня не залежать від переходу на літній час', () => {
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(weekdayOf('2026-11-09'), 1);
  assert.equal(weekdayOf('2026-11-08'), 7);
});

test('рядки: обрізання, обов’язковість, межа довжини', () => {
  assert.equal(str('  a  ', 'x'), 'a');
  assert.equal(str('', 'x', { required: false }), null);
  rejects(() => str('', 'x'));
  rejects(() => str('abc', 'x', { max: 2 }));
  rejects(() => str({ a: 1 }, 'x'));
});

test('числа й id', () => {
  assert.equal(int('5', 'x'), 5);
  assert.equal(id(3), 3);
  assert.deepEqual(idList([1, '2', 2], 'x'), [1, 2]);
  for (const bad of [0, -1, 'abc', 1.5, 2147483648, '9'.repeat(40), 1e40]) rejects(() => id(bad));
  rejects(() => idList('1', 'x'));
  rejects(() => idList([{}], 'x'));
});

test('гроші округлюються до копійок і не бувають від’ємними', () => {
  assert.equal(money('10.005', 'x'), 10.01);
  assert.equal(money(0, 'x'), 0);
  for (const bad of [-1, 'abc', Infinity, 1e9]) rejects(() => money(bad, 'x'));
});

test('normalizePhone: український номер без коду, міжнародний, сміття', () => {
  assert.equal(normalizePhone('067 123 45 67'), '+380671234567');
  assert.equal(normalizePhone('(067) 765-43-21'), '+380677654321');
  assert.equal(normalizePhone('+380 67 123 45 67'), '+380671234567');
  assert.equal(normalizePhone('+48 512 345 678'), '+48512345678');
  rejects(() => normalizePhone('12345'));
  rejects(() => normalizePhone(''));
  rejects(() => normalizePhone('067 123 45 67 ext'));
  rejects(() => normalizePhone('+1234567890123456'));
  rejects(() => normalizePhone(380671234567));
});
