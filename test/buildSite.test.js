import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSite } from '../src/build_site.js';

test('builds static pages, sitemap, and configured monetization markup', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'scrape-site-'));
  const data = {
    timestamp: '2026-08-19T00:00:00.000Z',
    title: 'Example data <brief>',
    text: 'Collected content for testing.',
    target: { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/' },
    metadata: { description: 'Test description', statusCode: 200 }
  };

  try {
    const result = await buildSite({
      data,
      outputDir,
      siteUrl: 'https://infinityempire.github.io/scrape-pipeline-api',
      paypalMeLink: 'https://www.paypal.com/paypalme/example',
      adsensePubId: 'ca-pub-1234567890123456'
    });
    const index = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    const detail = await readFile(path.join(outputDir, 'data', 'latest', 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(outputDir, 'sitemap.xml'), 'utf8');

    assert.equal(result.pages, 2);
    assert.match(index, /Example data &lt;brief&gt;/);
    assert.match(index, /paypal\.com\/paypalme\/example/);
    assert.match(index, /ca-pub-1234567890123456/);
    assert.match(detail, /Collected content for testing\./);
    assert.match(sitemap, /https:\/\/infinityempire\.github\.io\/scrape-pipeline-api\/data\/latest\//);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
