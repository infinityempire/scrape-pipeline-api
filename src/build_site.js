// Research site design: editorial data analysis with methodology, source attribution, and no monetization surface.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCachedScrape } from './upstash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public');

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function normalizeSiteUrl(value = 'http://localhost:8080') { return value.replace(/\/$/, ''); }
function formatDate(timestamp) { const parsed = new Date(timestamp); return Number.isNaN(parsed.getTime()) ? 'Unknown' : parsed.toISOString().replace('T', ' ').replace('.000Z', ' UTC'); }
function formatNumber(value) { return new Intl.NumberFormat('en-US').format(value ?? 0); }
function velocityDisplay(repository) { return repository.growthVelocityIndex === null ? 'Baseline' : `${repository.growthVelocityIndex.toFixed(2)} ★ / day`; }

function renderPage({ title, description, body, siteUrl, canonicalUrl = siteUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}"><title>${escapeHtml(title)}</title>
    <style>
      /* Research design: paper-and-ink editorial reading with a warm data ledger and restrained movement. */
      :root { --ink:#17212a; --muted:#687680; --paper:#f8f6f0; --white:#fffdf8; --line:#d9d6cc; --teal:#0a6959; --lime:#b5de78; --orange:#c95c22; }
      *{box-sizing:border-box} body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,'Times New Roman',serif;line-height:1.55} a{color:var(--teal)}
      header{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1.2rem max(1.25rem,calc((100vw - 78rem)/2));background:#142d2a;color:#f2f4e9;border-bottom:5px solid var(--lime)} header a{color:inherit;text-decoration:none;font:700 .8rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em;text-transform:uppercase}.nav{display:flex;gap:1.2rem;flex-wrap:wrap}.nav a{opacity:.82}.nav a:hover{opacity:1}
      main{width:min(78rem,calc(100% - 2.5rem));margin:0 auto;padding:3.5rem 0 5rem}.eyebrow{font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--teal)}h1{max-width:18ch;margin:.5rem 0 1rem;font-size:clamp(2.8rem,7vw,6rem);line-height:.92;letter-spacing:-.06em}h2{margin:3rem 0 1rem;font-size:1.6rem;letter-spacing:-.02em}.lede{max-width:66ch;font-size:1.2rem}.meta{font:500 .8rem/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted)}
      .hero-grid{display:grid;grid-template-columns:1.5fr .8fr;gap:2.5rem;align-items:end}.method,.notice{padding:1.2rem;border:1px solid var(--line);background:var(--white)}.method{border-top:4px solid var(--orange)}.notice{background:#edf5e4}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2.5rem 0}.metric{padding:1.2rem;border:1px solid var(--line);background:var(--white)}.metric strong{display:block;margin-top:.4rem;font-size:1.65rem;line-height:1}
      .table-wrap{overflow:auto;border:1px solid var(--line);background:var(--white)}table{border-collapse:collapse;width:100%;min-width:720px}th,td{padding:.9rem;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}th{font:.72rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:#eef0e8}td strong{display:block;font-size:1rem}.tag{display:inline-block;padding:.18rem .42rem;border:1px solid #b8d5cd;border-radius:999px;color:var(--teal);font:700 .68rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;margin:.12rem .12rem 0 0}.baseline{color:var(--orange)}
      footer{padding:2rem max(1.25rem,calc((100vw - 78rem)/2));border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}@media(max-width:760px){.hero-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}main{padding-top:2.25rem}h1{font-size:3.3rem}}
    </style>
  </head>
  <body><header><a href="${escapeHtml(siteUrl)}/">Open Repo Research</a><nav class="nav"><a href="${escapeHtml(siteUrl)}/methodology/">Methodology</a><a href="https://docs.github.com/en/rest/search/search" rel="noopener noreferrer">GitHub API docs ↗</a></nav></header><main>${body}</main><footer>Open research based on GitHub REST Search API metadata. Not affiliated with GitHub. Repository data, categories, and observed velocity may be incomplete or change between observations.</footer></body>
</html>`;
}

function rows(repositories) {
  return repositories.map((repository) => `<tr><td><strong><a href="${escapeHtml(repository.htmlUrl)}" rel="noopener noreferrer">${escapeHtml(repository.fullName)} ↗</a></strong><span class="meta">${escapeHtml(repository.description)}</span></td><td><span class="tag">${escapeHtml(repository.category)}</span><span class="meta">${escapeHtml(repository.language)}</span></td><td>${formatNumber(repository.stars)}</td><td class="${repository.growthVelocityIndex === null ? 'baseline' : ''}">${escapeHtml(velocityDisplay(repository))}<span class="meta">${repository.starDelta === null ? 'first observation' : `+${repository.starDelta} stars across ${repository.observedHours}h`}</span></td></tr>`).join('');
}

function renderIndex(data, config) {
  const repositories = data.research.repositories;
  const growing = repositories.filter((item) => item.growthVelocityIndex !== null).sort((a, b) => b.growthVelocityIndex - a.growthVelocityIndex)[0];
  const categories = new Set(repositories.map((item) => item.category)).size;
  const body = `<div class="hero-grid"><section><p class="eyebrow">Open research dashboard</p><h1>GitHub repository activity, observed.</h1><p class="lede">A source-linked research view of popular open repositories returned by the official GitHub REST Search API. The index records periodic star snapshots and classifies public repository metadata into broad technology categories.</p><p class="meta">Observed ${escapeHtml(formatDate(data.timestamp))} · Query: ${escapeHtml(data.metadata.query)}</p></section><aside class="method"><p class="eyebrow">Research status</p><p><strong>Open access, non-commercial.</strong></p><p class="meta">No advertising, affiliate links, or payment prompts are published in this research view.</p></aside></div><section class="metrics"><article class="metric"><span class="eyebrow">Repositories</span><strong>${repositories.length}</strong><span class="meta">returned by this observation</span></article><article class="metric"><span class="eyebrow">Categories</span><strong>${categories}</strong><span class="meta">keyword-based classifications</span></article><article class="metric"><span class="eyebrow">Highest observed velocity</span><strong>${growing ? escapeHtml(velocityDisplay(growing)) : 'Baseline'}</strong><span class="meta">${growing ? escapeHtml(growing.fullName) : 'requires a second observation'}</span></article></section><section class="notice"><strong>Interpretation:</strong> Growth Velocity Index is not GitHub's ranking and is not a prediction. It is the positive change in stars observed by this site between snapshots, annualized to 24 hours. The first snapshot is a baseline.</section><h2>Latest repository observation</h2><div class="table-wrap"><table><thead><tr><th>Repository</th><th>Category</th><th>Stars</th><th>Growth Velocity Index</th></tr></thead><tbody>${rows(repositories)}</tbody></table></div>`;
  return renderPage({ title: 'Open GitHub Repository Research', description: 'Open research view of popular GitHub repositories, classifications, and observed star growth.', body, siteUrl: config.siteUrl });
}

function renderMethodology(data, config) {
  const body = `<p class="eyebrow">Methodology and attribution</p><h1>What this index measures.</h1><p class="lede">This site uses public repository metadata returned by the official GitHub REST Search API. It does not scrape GitHub Trending pages or repository contents.</p><h2>Collection</h2><p>The pipeline sends one repository-search request for <code>${escapeHtml(data.metadata.query)}</code>, sorted by last update, and stores a compact snapshot in Upstash Redis. The endpoint may return incomplete results; this observation reported <code>${escapeHtml(String(data.metadata.incompleteResults))}</code>.</p><h2>Growth Velocity Index</h2><p>For a repository observed more than once, the index calculates the positive change in star count divided by elapsed observed hours and scales it to 24 hours. This describes only this site’s two snapshots; it is not a historical GitHub metric, a forecast, an endorsement, or investment advice.</p><h2>Classification</h2><p>Categories are transparent keyword-based labels using public repository names, descriptions, languages, and topics. They can be wrong or incomplete and should not be treated as GitHub editorial labels.</p><h2>Attribution and use</h2><p>Repository names link back to the original GitHub repositories. GitHub is not affiliated with this site. The project is an open-access research view and publishes no ads, affiliate links, or payment prompts.</p><p><a href="${escapeHtml(config.siteUrl)}/">← Back to the latest observation</a></p>`;
  return renderPage({ title: 'Methodology | Open GitHub Repository Research', description: 'Methodology, attribution, and limits for the GitHub API open research index.', body, siteUrl: config.siteUrl, canonicalUrl: `${config.siteUrl}/methodology/` });
}

function renderSitemap(siteUrl, lastmod) {
  const urls = [`${siteUrl}/`, `${siteUrl}/methodology/`];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeHtml(url)}</loc><lastmod>${escapeHtml(lastmod)}</lastmod></url>`).join('\n')}\n</urlset>\n`;
}

export async function buildSite({ data, outputDir = OUTPUT_DIR, siteUrl = normalizeSiteUrl(process.env.SITE_URL) } = {}) {
  const research = data || await getCachedScrape();
  if (research?.kind !== 'github-open-research') throw new Error('GitHub open research data is required. Run the GitHub API collector before building the site.');
  const config = { siteUrl: normalizeSiteUrl(siteUrl) };
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'methodology'), { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'index.html'), renderIndex(research, config), 'utf8'),
    writeFile(path.join(outputDir, 'methodology', 'index.html'), renderMethodology(research, config), 'utf8'),
    writeFile(path.join(outputDir, 'sitemap.xml'), renderSitemap(config.siteUrl, research.timestamp), 'utf8'),
    writeFile(path.join(outputDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`, 'utf8'),
    writeFile(path.join(outputDir, '.nojekyll'), '', 'utf8')
  ]);
  return { outputDir, pages: 2, timestamp: research.timestamp, indexingAllowed: true };
}

async function main() { console.info(JSON.stringify({ status: 'built', ...(await buildSite()) })); }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error); process.exit(1); });
