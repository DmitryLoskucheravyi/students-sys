import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { formatOffset, pool } from '../../server/db.js';

after(() => pool.end());

test('зсув часу у форматі MySQL', () => {
  assert.equal(formatOffset(120), '+02:00');
  assert.equal(formatOffset(180), '+03:00');
  assert.equal(formatOffset(0), '+00:00');
  assert.equal(formatOffset(-300), '-05:00');
  assert.equal(formatOffset(330), '+05:30');
});
