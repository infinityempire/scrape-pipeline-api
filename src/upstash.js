import 'dotenv/config';

const DEFAULT_CACHE_KEY = 'scrape:latest';
const DEFAULT_TTL_SECONDS = 86400;

function requireCredentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.');
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function execute(command, { fetchImpl = fetch } = {}) {
  const { url, token } = requireCredentials();
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Upstash REST request failed with HTTP ${response.status}.`);
  }
  return payload.result;
}

export function cacheKey() {
  return process.env.UPSTASH_CACHE_KEY || DEFAULT_CACHE_KEY;
}

export async function getCachedScrape(options) {
  const value = await execute(['GET', cacheKey()], options);
  return value ? JSON.parse(value) : null;
}

export async function setCachedScrape(data, { ttlSeconds = DEFAULT_TTL_SECONDS, ...options } = {}) {
  return execute(['SET', cacheKey(), JSON.stringify(data), 'EX', ttlSeconds], options);
}

export async function pingUpstash(options) {
  return execute(['PING'], options);
}
