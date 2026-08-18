import crypto from 'node:crypto';
import IORedis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { config } from './config.js';

export function cacheKeyForUrl(url) {
  const digest = crypto.createHash('sha256').update(url).digest('hex');
  return `extract:v1:${digest}`;
}

export function createRedisConnection() {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
}

export function createQueueServices() {
  const connection = createRedisConnection();
  const queue = new Queue(config.queueName, { connection });
  const queueEvents = new QueueEvents(config.queueName, { connection: connection.duplicate() });

  return {
    connection,
    queue,
    queueEvents,
    async ready() {
      await Promise.all([connection.ping(), queueEvents.waitUntilReady()]);
    },
    async close() {
      await Promise.allSettled([queue.close(), queueEvents.close(), connection.quit()]);
    }
  };
}

export async function getCachedExtraction(redis, url) {
  const cached = await redis.get(cacheKeyForUrl(url));
  return cached ? JSON.parse(cached) : null;
}

export async function enqueueAndWait({ queue, queueEvents, url }) {
  const key = cacheKeyForUrl(url);
  const job = await queue.add('extract', { url, cacheKey: key }, {
    jobId: key,
    attempts: 2,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: true
  });

  return job.waitUntilFinished(queueEvents, config.scrapeTimeoutMs + 10000);
}
