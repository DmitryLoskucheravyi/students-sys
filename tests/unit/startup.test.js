import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('у проді сервер не стартує без постійного сховища файлів', () => {
  const result = spawnSync(process.execPath, ['server/index.js'], {
    env: { ...process.env, NODE_ENV: 'production', S3_BUCKET: '', ALLOW_EPHEMERAL_UPLOADS: '', JWT_SECRET: 'x' },
    encoding: 'utf8',
    timeout: 20000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /S3_BUCKET/);
});
