import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCachedScrape } from './upstash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public');

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

function adSlot({ adsensePubId }) {
  if (!adsensePubId) {
    return '<div class="monetization-slot" data-monetization="adsense">AD PLACEHOLDER — Add an approved AdSense publisher ID through GitHub Actions configuration to enable the ad template.</div>';
  }
  return `<div class="monetization-slot" data-monetization="adsense" data-adsense-pub-id="${escapeHtml(adsensePubId)}"><ins class="adsbygoogle" style="display:block" data-ad-client="${escapeHtml(adsensePubId)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(window.adsbygoogle = window.adsbygoogle || []).push({});</script></div>`;
}

function supportCta({ paypalMeLink }) {
  if (!paypalMeLink) return '';
  return `<p class="support"><a href="${escapeHtml(paypalMeLink)}" rel="noopener noreferrer sponsored">Support this project via PayPal →</a></p>`;
}

function renderPage({ title, description, body, siteUrl, canonicalUrl = siteUrl, adsensePubId }) {
  const adScript = adsensePubId
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(adsensePubId)}" crossorigin="anonymous"></script>`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <title>${escapeHtml(title)}</title>
    ${adScript}
    <style>
      :root { color-scheme: light; --ink: #14212b; --muted: #62717d; --paper: #f7f5ef; --card: #ffffff; --accent: #126a58; --line: #d9dfdd; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--paper); color: var(--ink); font-family: Georgia, 'Times New Roman', serif; line-height: 1.6; }
      header { padding: 1.5rem max(1.25rem, calc((100vw - 70rem) / 2)); border-bottom: 1px solid var(--line); background: #eef3ed; }
      header a { color: var(--accent); font: 700 0.9rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-decoration: none; text-transform: uppercase; }
      main { width: min(70rem, calc(100% - 2.5rem)); margin: 0 auto; padding: 3.5rem 0 5rem; }
      .eyebrow { color: var(--accent); font: 700 0.75rem/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; }
      h1 { max-width: 20ch; margin: .5rem 0 1.2rem; font-size: clamp(2.2rem, 6vw, 4.8rem); line-height: .98; letter-spacing: -.05em; }
      h2 { margin-top: 2.5rem; font-size: 1.4rem; }
      p { max-width: 75ch; }
      .meta { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(15rem, .48fr); gap: 2.5rem; align-items: start; }
      .card, .monetization-slot { padding: 1.25rem; border: 1px solid var(--line); background: var(--card); }
      .monetization-slot { margin: 2rem 0; color: var(--muted); font: .78rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      .content { white-space: pre-wrap; overflow-wrap: anywhere; }
      .support a { display: inline-block; padding: .7rem 1rem; color: white; background: var(--accent); font: 700 .82rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; text-decoration: none; text-transform: uppercase; }
      a { color: var(--accent); }
      footer { padding: 2rem max(1.25rem, calc((100vw - 70rem) / 2)); border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } main { padding-top: 2.25rem; } }
    </style>
  </head>
  <body>
    <header><a href="${escapeHtml(siteUrl)}/">Data Brief</a></header>
    <main>${body}</main>
    <footer>Automatically generated from scheduled collection of a public source. Verify important information with the original source.</footer>
  </body>
</html>`;
}

function renderIndex(data, config) {
  const { siteUrl, adsensePubId, paypalMeLink } = config;
  const detailUrl = `${siteUrl}/data/latest/`;
  const sourceUrl = data.target?.finalUrl || data.target?.requestedUrl || '#';
  const description = data.metadata?.description || 'Freshly collected public data, published as a concise data brief.';
  const body = `
    <p class="eyebrow">Scheduled data brief</p>
    <h1>${escapeHtml(data.title || 'Latest source update')}</h1>
    <p class="meta">Last collected: ${escapeHtml(formatDate(data.timestamp))}</p>
    <div class="grid">
      <section>
        <p>${escapeHtml(description)}</p>
        <p><a href="${escapeHtml(detailUrl)}">Read the latest data brief →</a></p>
        ${adSlot({ adsensePubId })}
        ${supportCta({ paypalMeLink })}
      </section>
      <aside class="card">
        <p class="eyebrow">Source</p>
        <p><a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer">Visit original public source ↗</a></p>
        <p class="meta">HTTP status: ${escapeHtml(data.metadata?.statusCode ?? 'unknown')}</p>
        <p class="meta">Updated automatically every six hours.</p>
      </aside>
    </div>`;
  return renderPage({ title: data.title || 'Latest data brief', description, body, siteUrl, adsensePubId });
}

function renderDetail(data, config) {
  const { siteUrl, adsensePubId, paypalMeLink } = config;
  const description = data.metadata?.description || 'Automatically generated detail page from a public source.';
  const sourceUrl = data.target?.finalUrl || data.target?.requestedUrl || '#';
  const body = `
    <p class="eyebrow">Data detail</p>
    <h1>${escapeHtml(data.title || 'Latest source update')}</h1>
    <p class="meta">Collected ${escapeHtml(formatDate(data.timestamp))} · <a href="${escapeHtml(sourceUrl)}" rel="noopener noreferrer">Original source ↗</a></p>
    <div class="monetization-slot" data-monetization="affiliate">AFFILIATE PLACEHOLDER — Replace only with clearly disclosed, approved affiliate links relevant to this page.</div>
    ${adSlot({ adsensePubId })}
    ${supportCta({ paypalMeLink })}
    <section class="content">${escapeHtml(data.text || 'No text content was extracted.')}</section>
    <p><a href="${escapeHtml(siteUrl)}/">← Back to the latest brief</a></p>`;
  return renderPage({ title: data.title || 'Data detail', description, body, siteUrl, canonicalUrl: `${siteUrl}/data/latest/`, adsensePubId });
}

function renderSitemap(siteUrl, lastmod) {
  const urls = [`${siteUrl}/`, `${siteUrl}/data/latest/`];
  const entries = urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc><lastmod>${escapeHtml(lastmod)}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

export async function buildSite({ data, outputDir = OUTPUT_DIR, siteUrl = normalizeSiteUrl(process.env.SITE_URL), paypalMeLink = validatePayPalLink(process.env.PAYPAL_ME_LINK), adsensePubId = validateAdSensePublisherId(process.env.ADSENSE_PUB_ID) } = {}) {
  const scrape = data || await getCachedScrape();
  if (!scrape) throw new Error('No cached data exists. Run the scheduled scraper before building the site.');

  const config = { siteUrl: normalizeSiteUrl(siteUrl), paypalMeLink, adsensePubId };
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'data', 'latest'), { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'index.html'), renderIndex(scrape, config), 'utf8'),
    writeFile(path.join(outputDir, 'data', 'latest', 'index.html'), renderDetail(scrape, config), 'utf8'),
    writeFile(path.join(outputDir, 'sitemap.xml'), renderSitemap(config.siteUrl, new Date(scrape.timestamp || Date.now()).toISOString()), 'utf8'),
    writeFile(path.join(outputDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`, 'utf8'),
    writeFile(path.join(outputDir, '.nojekyll'), '', 'utf8')
  ]);
  return { outputDir, pages: 2, timestamp: scrape.timestamp };
}

async function main() {
  const result = await buildSite();
  console.info(JSON.stringify({ status: 'built', ...result }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
