import { Worker } from 'bullmq';
import { config, validateConfig } from './config.js';
import { createRedisConnection } from './queue.js';
import { extractFromUrl } from './scraper.js';
import { assertSafePublicUrl } from './urlSafety.js';

validateConfig(['REDIS_URL']);

const redis = createRedisConnection();
const workerConnection = createRedisConnection();

const worker = new Worker(
  config.queueName,
  async (job) => {
    const url = await assertSafePublicUrl(job.data.url, { allowPrivateNetworks: config.allowPrivateNetworks });
    const data = await extractFromUrl(url, { timeoutMs: config.scrapeTimeoutMs });
    await redis.set(job.data.cacheKey, JSON.stringify(data), 'EX', config.cacheTtlSeconds);
    return data;
  },
  {
    connection: workerConnection,
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10)
  }
);

worker.on('completed', (job) => console.info({ jobId: job.id }, 'Extraction completed'));
worker.on('failed', (job, error) => console.error({ jobId: job?.id, error: error.message }, 'Extraction failed'));

async function shutdown(signal) {
  console.info(`${signal} received; stopping worker.`);
  await worker.close();
  await Promise.allSettled([redis.quit(), workerConnection.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
