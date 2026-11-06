import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { packFile, unpackFile } from '../../server/compress.js';

test('текст і код стискаються й відновлюються байт у байт', async () => {
  const source = Buffer.from('function add(a, b) { return a + b; } // коментар\n'.repeat(5000));
  const { data, gzipped } = await packFile(source);
  assert.equal(gzipped, true);
  assert.ok(data.length < source.length / 5, `${data.length} із ${source.length}`);
  assert.deepEqual(await unpackFile(data, gzipped), source);
});

test('уже стиснуте зберігається як є', async () => {
  const source = randomBytes(200_000);
  const { data, gzipped } = await packFile(source);
  assert.equal(gzipped, false);
  assert.equal(data, source);
  assert.equal(await unpackFile(data, gzipped), source);
});

test('порожній файл не ламає стиснення', async () => {
  const { data, gzipped } = await packFile(Buffer.alloc(0));
  assert.equal((await unpackFile(data, gzipped)).length, 0);
});
