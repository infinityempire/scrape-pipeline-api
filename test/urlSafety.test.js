import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicHttpUrl } from '../src/urlSafety.js';

test('accepts a public HTTPS URL', () => {
  const result = isPublicHttpUrl('https://example.com/articles?id=1');
  assert.equal(result.valid, true);
  assert.equal(result.url.hostname, 'example.com');
});

test('rejects non-HTTP schemes', () => {
  assert.deepEqual(isPublicHttpUrl('file:///etc/passwd'), {
    valid: false,
    reason: 'Only http and https URLs are supported.'
  });
});

test('rejects local and private IP targets', () => {
  assert.equal(isPublicHttpUrl('http://localhost:3000').valid, false);
  assert.equal(isPublicHttpUrl('http://127.0.0.1/admin').valid, false);
  assert.equal(isPublicHttpUrl('http://10.0.0.4/metadata').valid, false);
  assert.equal(isPublicHttpUrl('http://192.168.1.2').valid, false);
});

test('rejects URLs containing credentials', () => {
  assert.equal(isPublicHttpUrl('https://user:password@example.com').valid, false);
});
