import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isChunkError } from '../../client/src/chunkError.js';

test('isChunkError: збої завантаження коду після деплою в різних браузерах', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://x/assets/Site-abc.js', // Chrome
    'error loading dynamically imported module', // Firefox
    'Importing a module script failed.', // Safari
    'Unable to preload CSS for /assets/site-1.css', // Vite
  ]) assert.equal(isChunkError(new TypeError(message)), true, message);
  assert.equal(isChunkError({ name: 'ChunkLoadError', message: '' }), true);
});

test('isChunkError: звичайні помилки і порожні значення — ні', () => {
  assert.equal(isChunkError(new TypeError("Cannot read properties of undefined (reading 'map')")), false);
  assert.equal(isChunkError(null), false);
  assert.equal(isChunkError(undefined), false);
  assert.equal(isChunkError('рядок'), false);
});
