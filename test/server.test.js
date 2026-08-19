import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('returns a cached payload without invoking a scraper', async () => {
  const cachedData = { timestamp: '2026-08-19T00:00:00.000Z', title: 'Cached Data' };
  const app = createApp({ getCached: async () => cachedData, ping: async () => 'PONG' });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/data`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { cached: true, timestamp: cachedData.timestamp, data: cachedData });
  });
});

test('returns a fallback response when cache is empty', async () => {
  const app = createApp({ getCached: async () => null, ping: async () => 'PONG' });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/data`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.cached, false);
  });
});

test('health reports Upstash availability', async () => {
  const app = createApp({ getCached: async () => null, ping: async () => 'PONG' });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).redis, 'ready');
  });
});
