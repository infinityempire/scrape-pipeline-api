import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSite } from '../src/build_site.js';

test('builds an indexable GitHub open research site with attribution and methodology', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'github-research-site-'));
  const data = {
    kind: 'github-open-research',
    timestamp: '2026-08-19T00:00:00.000Z',
    title: 'Open GitHub repository research',
    metadata: { query: 'stars:>1000', incompleteResults: false },
    research: {
      repositories: [{
        id: 1, fullName: 'example/research-tool', name: 'research-tool', htmlUrl: 'https://github.com/example/research-tool',
        description: 'A sample open research repository.', language: 'JavaScript', topics: ['research'], stars: 1200,
        forks: 90, openIssues: 2, observedAt: '2026-08-19T00:00:00.000Z', category: 'Developer Tools',
        starDelta: 12, observedHours: 6, growthVelocityIndex: 48, trendStatus: 'Observed growth'
      }]
    }
  };

  try {
    const result = await buildSite({ data, outputDir, siteUrl: 'https://infinityempire.github.io/scrape-pipeline-api' });
    const index = await readFile(path.join(outputDir, 'index.html'), 'utf8');
    const methodology = await readFile(path.join(outputDir, 'methodology', 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(outputDir, 'sitemap.xml'), 'utf8');
    const robots = await readFile(path.join(outputDir, 'robots.txt'), 'utf8');

    assert.equal(result.pages, 2);
    assert.match(index, /example\/research-tool/);
    assert.match(index, /48\.00 ★ \/ day/);
    assert.match(index, /No advertising, affiliate links, or payment prompts/);
    assert.doesNotMatch(index, /paypal\.me/);
    assert.match(methodology, /GitHub REST Search API/);
    assert.match(sitemap, /methodology/);
    assert.match(robots, /Allow: \//);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
