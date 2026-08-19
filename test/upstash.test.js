import assert from 'node:assert/strict';
import test from 'node:test';
import { getCachedScrape, setCachedScrape } from '../src/upstash.js';

function withUpstashEnv(callback) {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  return Promise.resolve(callback()).finally(() => {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });
}

test('stores a serialized scrape with an expiration', async () => {
  await withUpstashEnv(async () => {
    let request;
    const fetchImpl = async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
    };
    const value = { timestamp: '2026-08-19T00:00:00.000Z', title: 'Example' };
    await setCachedScrape(value, { ttlSeconds: 86400, fetchImpl });

    assert.equal(request.url, 'https://example.upstash.io');
    assert.equal(request.options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(request.options.body), ['SET', 'scrape:latest', JSON.stringify(value), 'EX', 86400]);
  });
});

test('returns parsed cached data from Upstash', async () => {
  await withUpstashEnv(async () => {
    const expected = { timestamp: '2026-08-19T00:00:00.000Z', title: 'Cached Example' };
    const fetchImpl = async () => new Response(JSON.stringify({ result: JSON.stringify(expected) }), { status: 200 });
    const value = await getCachedScrape({ fetchImpl });
    assert.deepEqual(value, expected);
  });
});
