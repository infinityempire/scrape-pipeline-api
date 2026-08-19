import express from 'express';
import { getCachedScrape, pingUpstash } from './upstash.js';

const port = Number.parseInt(process.env.PORT ?? '8080', 10);
const maxRequestBodyBytes = process.env.MAX_REQUEST_BODY_BYTES ?? '10kb';

export function createApp({ getCached = getCachedScrape, ping = pingUpstash } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: maxRequestBodyBytes }));

  app.get('/health', async (_req, res) => {
    try {
      await ping();
      res.status(200).json({ status: 'ok', redis: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: 'unavailable', redis: 'unreachable', message: error.message });
    }
  });

  app.get('/api/v1/data', async (_req, res) => {
    try {
      const data = await getCached();
      if (!data) {
        return res.status(404).json({
          cached: false,
          message: 'No cached scrape is available yet. Run the scheduled scraper or trigger the workflow manually.'
        });
      }
      return res.status(200).json({ cached: true, timestamp: data.timestamp, data });
    } catch (error) {
      return res.status(503).json({ cached: false, message: 'Cache is unavailable.', error: error.message });
    }
  });

  return app;
}

function start() {
  const app = createApp();
  const server = app.listen(port, () => console.info(`Cache API listening on port ${port}`));

  const shutdown = (signal) => {
    console.info(`${signal} received; shutting down API.`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start();
}
