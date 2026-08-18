import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { assertSafePublicUrl } from './urlSafety.js';

puppeteer.use(StealthPlugin());

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);
const DEFAULT_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu'
];

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function formatFailure(error) {
  if (error?.name === 'TimeoutError') return 'The target page exceeded the execution timeout.';
  return error?.message || 'The extraction failed unexpectedly.';
}

export async function extractFromUrl(url, { timeoutMs = 15000 } = {}) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: DEFAULT_BROWSER_ARGS,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) {
        await request.abort('blockedbyclient').catch(() => {});
        return;
      }
      try {
        await assertSafePublicUrl(request.url(), { allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === 'true' });
        await request.continue();
      } catch {
        await request.abort('blockedbyclient').catch(() => {});
      }
    });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const pageData = await page.evaluate(() => {
      const first = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || null;
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
      return {
        title: document.title?.trim() || null,
        text: document.body ? document.body.innerText : '',
        metadata: {
          description: first('meta[name="description"]') || first('meta[property="og:description"]'),
          canonical,
          language: document.documentElement.lang || null,
          charset: document.characterSet || null
        }
      };
    });

    return {
      title: pageData.title,
      text: normalizeText(pageData.text).slice(0, 1_000_000),
      metadata: {
        ...pageData.metadata,
        requestedUrl: url,
        finalUrl: response?.url() ?? page.url(),
        statusCode: response?.status() ?? null,
        contentType: response?.headers()['content-type'] ?? null
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const extractionError = new Error(formatFailure(error));
    extractionError.code = error?.name === 'TimeoutError' ? 'SCRAPE_TIMEOUT' : 'SCRAPE_FAILED';
    throw extractionError;
  } finally {
    await browser?.close().catch(() => {});
  }
}
