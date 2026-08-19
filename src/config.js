import 'dotenv/config';

const required = ['REDIS_URL', 'API_KEY'];

export function validateConfig(requiredKeys = required) {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function asPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = Object.freeze({
  port: asPositiveInteger(process.env.PORT, 8080),
  redisUrl: process.env.REDIS_URL ?? '',
  apiKey: process.env.API_KEY ?? '',
  scrapeTimeoutMs: asPositiveInteger(process.env.SCRAPE_TIMEOUT_MS, 15000),
  cacheTtlSeconds: asPositiveInteger(process.env.CACHE_TTL_SECONDS, 3600),
  maxRequestBodyBytes: process.env.MAX_REQUEST_BODY_BYTES ?? '10kb',
  allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === 'true'
});
