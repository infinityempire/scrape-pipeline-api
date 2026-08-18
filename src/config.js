import 'dotenv/config';

const required = ['REDIS_URL', 'API_KEY'];

export function validateConfig(requiredKeys = required) {
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const config = Object.freeze({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  redisUrl: process.env.REDIS_URL ?? '',
  apiKey: process.env.API_KEY ?? '',
  scrapeTimeoutMs: Number.parseInt(process.env.SCRAPE_TIMEOUT_MS ?? '15000', 10),
  cacheTtlSeconds: Number.parseInt(process.env.CACHE_TTL_SECONDS ?? '3600', 10),
  queueName: process.env.QUEUE_NAME ?? 'extraction-jobs',
  maxRequestBodyBytes: process.env.MAX_REQUEST_BODY_BYTES ?? '10kb',
  allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === 'true'
});
