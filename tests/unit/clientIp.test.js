import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientIp } from '../../server/common/client-ip.js';

test('адреса відвідувача: перша з X-Forwarded-For, інакше req.ip', () => {
  assert.equal(clientIp('203.0.113.7, 10.0.0.1', '10.0.0.1'), '203.0.113.7');
  assert.equal(clientIp(' 203.0.113.7 ', undefined), '203.0.113.7');
  assert.equal(clientIp(['198.51.100.2, 10.0.0.1', '1.1.1.1'], '10.0.0.1'), '198.51.100.2');
  assert.equal(clientIp(undefined, '127.0.0.1'), '127.0.0.1');
  assert.equal(clientIp('', '127.0.0.1'), '127.0.0.1');
  assert.equal(clientIp(undefined, undefined), '');
});
