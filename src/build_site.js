// Content design: a calm editorial data brief that separates source material, disclosures, and optional monetization.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCachedScrape } from './upstash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public');
const MAX_EXCERPT_LENGTH = 1_600;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSiteUrl(value = 'http://localhost:8080') {
  return value.replace(/\/$/, '');
}

function envIsTrue(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function validatePayPalLink(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function validateAdSensePublisherId(value) {
  return /^ca-pub-\d{16}$/.test(value ?? '') ? value : null;
}

function formatDate(timestamp) {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

function createExcerpt(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_EXCERPT_LENGTH) return clean;
  const boundary = clean.lastIndexOf(' ', MAX_EXCERPT_LENGTH);
  return `${clean.slice(0, boundary > 0 ? boundary : MAX_EXCERPT_LENGTH)}…`;
}

function adSlot({ adsensePubId }) {
  if (!adsensePubId) {
    return '<aside class="notice monetization-slot"><strong>Advertising is disabled.</strong> An ad provider must approve this site before an ad identifier is configured.</aside>';
  }
  return `<aside class="monetization-slot" aria-label="Advertisement" data-monetization="adsense"><p class="eyebrow">Advertisement</p><ins class="adsbygoogle" style="display:block" data-ad-client="${escapeHtml(adsensePubId)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script></aside>`;
}

function supportCta({ paypalMeLink }) {
  if (!paypalMeLink) return '';
  return `<aside class="notice"><strong>Optional support.</strong> <a href="${escapeHtml(paypalMeLink)}" rel="noopener noreferrer sponsored">Open the project’s PayPal support link</a>. This is voluntary support, not a purchase or a promise of any outcome.</aside>`;
}

function affiliateDisclosure() {
  return '<aside class="notice"><strong>Affiliate disclosure.</strong> This site does not currently publish affiliate links. If approved affiliate links are added later, they will be labeled, use <code>rel="sponsored nofollow"</code>, and may earn a commission at no extra cost to a visitor.</aside>';
}

function renderPage({ title, description, body, siteUrl, canonicalUrl = siteUrl, adsensePubId, indexingAllowed }) {
  const adScript = adsensePubId
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(adsensePubId)}" crossorigin="anonymous"></script>`
    : '';
  const robots = indexingAllowed ? 'index,follow' : 'noindex,nofollow';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <title>${escapeHtml(title)}</title>
    ${adScript}
    <style>
      /* Content design: restrained editorial hierarchy, clear paid-content separation, and source-led reading. */
      :root { color-scheme: light; --ink: #14212b; --muted: #62717d; --paper: #f7f5ef; --card: #fff; --accent: #126a58; --line: #d9dfdd; --note: #edf5f1; }
      * { box-sizing: border-box; } body { margin: 0; background: var(--paper); color: var(--ink); font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; }
      header { padding: 1.5rem max(1.25rem, calc((100vw - 70rem) / 2)); border-bottom: 1px solid var(--line); background: #eef3ed; }
      header a { color: var(--accent); font: 700 .9rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
      main { width: min(70rem, calc(100% - 2.5rem)); margin: 0 auto; padding: 3.5rem 0 5rem; } .eyebrow { color: var(--accent); font: 700 .75rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; }
      h1 { max-width: 20ch; margin: .5rem 0 1.2rem; font-size: clamp(2.2rem, 6vw, 4.8rem); line-height: .98; letter-spacing: -.05em; } h2 { margin-top: 2.5rem; font-size: 1.4rem; } p { max-width: 75ch; }
      .meta { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; } .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(15rem, .48fr); gap: 2.5rem; align-items: start; }
      .card, .monetization-slot, .notice { padding: 1.25rem; border: 1px solid var(--line); background: var(--card); } .notice { margin: 1.5rem 0; background: var(--note); } .monetization-slot { margin: 2rem 0; color: var(--muted); }
      .content { white-space: pre-wrap; overflow-wrap: anywhere; } a { color: var(--accent); } code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
      footer { padding: 2rem max(1.25rem, calc((100vw - 70rem) / 2)); border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; } footer a { color: inherit; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding-top: 2.25rem; } }
    </style>
  </head>
  <body>
    <header><a href="${escapeHtml(siteUrl)}/">Data Brief</a></header>
    <main>${body}</main>
    <footer>Scheduled source monitoring with source links, a short excerpt, and transparent monetization labels. <a href="${escapeHtml(siteUrl)}/policy/">Read the content policy</a>.</footer>
  </body>
</html>`;
}

function renderSourceCard({ sourceUrl, data, config }) {
  const permissionState = config.sourcePermissionConfirmed ? 'Owner confirmation recorded for this source configuration.' : 'Indexing remains disabled until the site owner confirms source permission and added value.';
  return `<aside class="card"><p class="eyebrow">Source and publication status</p><p><a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer">Visit original public source ↗</a></p><p class="meta">HTTP status: ${escapeHtml(data.metadata?.statusCode ?? 'unknown')}</p><p class="meta">${escapeHtml(permissionState)}</p><p class="meta">Updated automatically every six hours.</p></aside>`;
}

function renderIndex(data, config) {
  const detailUrl = `${config.siteUrl}/data/latest/`;
  const sourceUrl = data.target?.finalUrl || data.target?.requestedUrl || '#';
  const description = data.metadata?.description || 'A timestamped, source-linked data brief.';
  const body = `<p class="eyebrow">Scheduled data brief</p><h1>${escapeHtml(data.title || 'Latest source update')}</h1><p class="meta">Last collected: ${escapeHtml(formatDate(data.timestamp))}</p><div class="grid"><section><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(detailUrl)}">Read the source-linked excerpt →</a></p>${affiliateDisclosure()}${adSlot(config)}${supportCta(config)}</section>${renderSourceCard({ sourceUrl, data, config })}</div>`;
  return renderPage({ title: data.title || 'Latest data brief', description, body, siteUrl: config.siteUrl, adsensePubId: config.adsensePubId, indexingAllowed: config.indexingAllowed });
}

function renderDetail(data, config) {
  const description = data.metadata?.description || 'Source-linked, automatically refreshed data excerpt.';
  const sourceUrl = data.target?.finalUrl || data.target?.requestedUrl || '#';
  const excerpt = createExcerpt(data.text);
  const body = `<p class="eyebrow">Source-linked excerpt</p><h1>${escapeHtml(data.title || 'Latest source update')}</h1><p class="meta">Collected ${escapeHtml(formatDate(data.timestamp))} · <a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer">Original source ↗</a></p><div class="notice"><strong>Editorial note.</strong> This page provides a short automated excerpt and source link. It is not a full republication, recommendation, or substitute for the original source.</div><section class="content">${escapeHtml(excerpt || 'No text content was extracted.')}</section>${affiliateDisclosure()}${adSlot(config)}${supportCta(config)}<p><a href="${escapeHtml(config.siteUrl)}/">← Back to the latest brief</a></p>`;
  return renderPage({ title: data.title || 'Data detail', description, body, siteUrl: config.siteUrl, canonicalUrl: `${config.siteUrl}/data/latest/`, adsensePubId: config.adsensePubId, indexingAllowed: config.indexingAllowed });
}

function renderPolicy(config) {
  const body = `<p class="eyebrow">Publishing policy</p><h1>Source-led, transparent automation.</h1><p>This site is intentionally configured to publish a source link, a timestamp, and a short excerpt. It is not a promise of accuracy, search visibility, advertising approval, or revenue.</p><h2>Source permission and value</h2><p>The owner must confirm permission to access and reuse or excerpt a source before enabling indexing. A documented value statement is required before pages can be indexable.</p><h2>Advertising, affiliate links, and support</h2><p>Optional support links are voluntary. Affiliate links, if later approved and added, will be clearly disclosed and marked as sponsored. Advertising requires provider approval and must not be confused with navigation or content.</p><h2>Current status</h2><p class="meta">Indexing: ${config.indexingAllowed ? 'enabled after owner confirmation and value statement' : 'disabled pending owner confirmation and a documented value statement'}.</p><p><a href="${escapeHtml(config.siteUrl)}/">← Back to the latest brief</a></p>`;
  return renderPage({ title: 'Content and monetization policy', description: 'Source, disclosure, and indexing policy for the automated data brief.', body, siteUrl: config.siteUrl, canonicalUrl: `${config.siteUrl}/policy/`, adsensePubId: null, indexingAllowed: config.indexingAllowed });
}

function renderSitemap(siteUrl, lastmod, indexingAllowed) {
  if (!indexingAllowed) return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Sitemap withheld until the owner confirms source permission and a documented user benefit. -->\n';
  const urls = [`${siteUrl}/`, `${siteUrl}/data/latest/`, `${siteUrl}/policy/`];
  const entries = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc><lastmod>${escapeHtml(lastmod)}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export async function buildSite({ data, outputDir = OUTPUT_DIR, siteUrl = normalizeSiteUrl(process.env.SITE_URL), paypalMeLink = validatePayPalLink(process.env.PAYPAL_ME_LINK), adsensePubId = validateAdSensePublisherId(process.env.ADSENSE_PUB_ID), sourcePermissionConfirmed = envIsTrue(process.env.SOURCE_PERMISSION_CONFIRMED), originalValueStatement = process.env.ORIGINAL_VALUE_STATEMENT?.trim() || '', enableSearchIndexing = envIsTrue(process.env.ENABLE_SEARCH_INDEXING) } = {}) {
  const scrape = data || await getCachedScrape();
  if (!scrape) throw new Error('No cached data exists. Run the scheduled scraper before building the site.');
  const indexingAllowed = sourcePermissionConfirmed && enableSearchIndexing && originalValueStatement.length >= 30;
  const config = { siteUrl: normalizeSiteUrl(siteUrl), paypalMeLink, adsensePubId, sourcePermissionConfirmed, originalValueStatement, indexingAllowed };
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'data', 'latest'), { recursive: true });
  await mkdir(path.join(outputDir, 'policy'), { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'index.html'), renderIndex(scrape, config), 'utf8'),
    writeFile(path.join(outputDir, 'data', 'latest', 'index.html'), renderDetail(scrape, config), 'utf8'),
    writeFile(path.join(outputDir, 'policy', 'index.html'), renderPolicy(config), 'utf8'),
    writeFile(path.join(outputDir, 'sitemap.xml'), renderSitemap(config.siteUrl, new Date(scrape.timestamp || Date.now()).toISOString(), indexingAllowed), 'utf8'),
    writeFile(path.join(outputDir, 'robots.txt'), indexingAllowed ? `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', 'utf8'),
    writeFile(path.join(outputDir, '.nojekyll'), '', 'utf8')
  ]);
  return { outputDir, pages: 3, timestamp: scrape.timestamp, indexingAllowed };
}

async function main() {
  const result = await buildSite();
  console.info(JSON.stringify({ status: 'built', ...result }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
