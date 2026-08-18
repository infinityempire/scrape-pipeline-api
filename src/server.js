import crypto from 'node:crypto';
import express from 'express';
import { config, validateConfig } from './config.js';
import { createQueueServices, enqueueAndWait, getCachedExtraction } from './queue.js';
import { assertSafePublicUrl } from './urlSafety.js';

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left ?? '');
  const rightBuffer = Buffer.from(right ?? '');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireApiKey(req, res, next) {
  if (!secureEqual(req.get('X-API-KEY'), config.apiKey)) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A valid X-API-KEY header is required.' } });
  }
  next();
}

function asErrorResponse(error) {
  if (error?.code === 'UNSAFE_URL') return { status: 400, code: error.code, message: error.message };
  if (error?.code === 'SCRAPE_TIMEOUT') return { status: 504, code: error.code, message: error.message };
  if (error?.code === 'SCRAPE_FAILED') return { status: 502, code: error.code, message: error.message };
  return { status: 500, code: 'INTERNAL_ERROR', message: 'The extraction request could not be completed.' };
}

export async function createApp() {
  validateConfig();
  const services = createQueueServices();
  await services.ready();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: config.maxRequestBodyBytes }));

  app.get('/health', async (_req, res) => {
    try {
      await services.connection.ping();
      res.status(200).json({ status: 'ok', redis: 'ready', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'unavailable', redis: 'unreachable' });
    }
  });

  app.post('/api/v1/extract', requireApiKey, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body.url !== 'string' || req.body.url.length > 2048) {
        return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Request body must contain a URL string no longer than 2048 characters.' } });
      }

      const url = await assertSafePublicUrl(req.body.url, { allowPrivateNetworks: config.allowPrivateNetworks });
      const cached = await getCachedExtraction(services.connection, url);
      if (cached) return res.status(200).json({ cached: true, data: cached });

      const data = await enqueueAndWait({ queue: services.queue, queueEvents: services.queueEvents, url });
      return res.status(200).json({ cached: false, data });
    } catch (error) {
      if (error?.code || error?.name === 'Error') {
        const response = asErrorResponse(error);
        return res.status(response.status).json({ error: { code: response.code, message: response.message } });
      }
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } });
  });

  return { app, services };
}

async function start() {
  const { app, services } = await createApp();
  const server = app.listen(config.port, () => console.info(`API listening on port ${config.port}`));

  const shutdown = async (signal) => {
    console.info(`${signal} received; shutting down API.`);
    server.close(async () => {
      await services.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
