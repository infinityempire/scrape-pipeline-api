// Data collection policy: public-source extraction with SSRF protection and explicit owner authorization for scheduled runs.
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { setCachedScrape } from './upstash.js';
import { assertSafePublicUrl } from './urlSafety.js';

puppeteer.use(StealthPlugin());

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);
const DEFAULT_BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

function normalizeText(value) { return value.replace(/\s+/g, ' ').trim(); }
function formatFailure(error) { return error?.name === 'TimeoutError' ? 'The target page exceeded the execution timeout.' : error?.message || 'The extraction failed unexpectedly.'; }

export async function extractFromUrl(url, { timeoutMs = 15000 } = {}) {
  let browser;
  try {
    const requestedUrl = await assertSafePublicUrl(url, { allowPrivateNetworks: false });
    browser = await puppeteer.launch({ headless: true, args: DEFAULT_BROWSER_ARGS, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs); page.setDefaultTimeout(timeoutMs);
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 }); await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) return request.abort('blockedbyclient').catch(() => {});
      try { await assertSafePublicUrl(request.url(), { allowPrivateNetworks: false }); await request.continue(); } catch { await request.abort('blockedbyclient').catch(() => {}); }
    });
    const response = await page.goto(requestedUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const pageData = await page.evaluate(() => {
      const meta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || null;
      return { title: document.title?.trim() || null, text: document.body?.innerText || '', metadata: { description: meta('meta[name="description"]') || meta('meta[property="og:description"]'), canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null, language: document.documentElement.lang || null, charset: document.characterSet || null } };
    });
    return { timestamp: new Date().toISOString(), target: { requestedUrl, finalUrl: response?.url() ?? page.url() }, title: pageData.title, text: normalizeText(pageData.text).slice(0, 250000), metadata: { ...pageData.metadata, statusCode: response?.status() ?? null, contentType: response?.headers()['content-type'] ?? null } };
  } catch (error) {
    const extractionError = new Error(formatFailure(error)); extractionError.code = error?.name === 'TimeoutError' ? 'SCRAPE_TIMEOUT' : 'SCRAPE_FAILED'; throw extractionError;
  } finally { await browser?.close().catch(() => {}); }
}

export async function runScheduledScrape() {
  const targetUrl = process.env.TARGET_URL;
  if (!targetUrl) throw new Error('TARGET_URL is required for the scheduled scraper.');
  if (String(process.env.SOURCE_PERMISSION_CONFIRMED).toLowerCase() !== 'true') throw new Error('SOURCE_PERMISSION_CONFIRMED=true is required before a scheduled scrape. Confirm permission to access and excerpt the target source.');
  const timeoutMs = Number.parseInt(process.env.SCRAPE_TIMEOUT_MS ?? '15000', 10);
  const ttlSeconds = Number.parseInt(process.env.CACHE_TTL_SECONDS ?? '86400', 10);
  const data = await extractFromUrl(targetUrl, { timeoutMs }); await setCachedScrape(data, { ttlSeconds }); return data;
}

async function main() { const data = await runScheduledScrape(); console.info(JSON.stringify({ status: 'stored', timestamp: data.timestamp, target: data.target.finalUrl })); }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error); process.exit(1); });
