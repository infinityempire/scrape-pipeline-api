// Research data layer: GitHub REST Search API only; no HTML scraping and no commercial output.
import { getCachedScrape, setCachedScrape } from './upstash.js';

const API_URL = 'https://api.github.com/search/repositories';
const DEFAULT_QUERY = 'stars:>1000';
const MAX_REPOSITORIES = 30;

function categoryFor(repository) {
  const terms = [repository.name, repository.full_name, repository.description, repository.language, ...(repository.topics ?? [])]
    .filter(Boolean).join(' ').toLowerCase();
  if (/(ai|llm|machine learning|machine-learning|deep learning|generative|gpt|agent|model)/.test(terms)) return 'AI & ML';
  if (/(security|auth|crypt|vulnerability|privacy|password)/.test(terms)) return 'Security';
  if (/(data|analytics|database|vector|etl|warehouse|observability)/.test(terms)) return 'Data & Analytics';
  if (/(cloud|kubernetes|docker|terraform|serverless|devops|infrastructure)/.test(terms)) return 'Cloud & Infrastructure';
  if (/(web|frontend|react|vue|angular|css|ui|browser)/.test(terms)) return 'Web & Interface';
  if (/(cli|sdk|framework|compiler|language|developer|devtool|api)/.test(terms)) return 'Developer Tools';
  return 'Open Source';
}

function indexPrevious(research) {
  return new Map((research?.research?.repositories ?? []).map((item) => [item.id, item]));
}

function velocityFor(repository, previous, observedAt) {
  const prior = previous.get(repository.id);
  if (!prior?.stars || !prior.observedAt) return { starDelta: null, observedHours: null, growthVelocityIndex: null, trendStatus: 'Baseline' };
  const hours = Math.max(1 / 60, (Date.parse(observedAt) - Date.parse(prior.observedAt)) / 3_600_000);
  const delta = Math.max(0, repository.stargazers_count - prior.stars);
  return {
    starDelta: delta,
    observedHours: Math.round(hours * 100) / 100,
    growthVelocityIndex: Math.round((delta / hours) * 24 * 100) / 100,
    trendStatus: delta > 0 ? 'Observed growth' : 'No observed growth'
  };
}

function mapRepository(repository, previous, observedAt) {
  const velocity = velocityFor(repository, previous, observedAt);
  return {
    id: repository.id,
    fullName: repository.full_name,
    name: repository.name,
    htmlUrl: repository.html_url,
    description: repository.description || 'No description provided by the repository.',
    language: repository.language || 'Not specified',
    topics: Array.isArray(repository.topics) ? repository.topics.slice(0, 8) : [],
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    observedAt,
    category: categoryFor(repository),
    ...velocity
  };
}

export async function fetchGitHubResearch({ fetchImpl = fetch, now = new Date(), query = process.env.GITHUB_RESEARCH_QUERY || DEFAULT_QUERY } = {}) {
  const token = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN || '';
  const url = new URL(API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(MAX_REPOSITORIES));
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `GitHub REST API returned HTTP ${response.status}.`);
  const observedAt = now.toISOString();
  const previous = indexPrevious(await getCachedScrape());
  const repositories = (payload.items ?? []).map((repository) => mapRepository(repository, previous, observedAt));
  return {
    kind: 'github-open-research',
    timestamp: observedAt,
    title: 'Open GitHub repository research',
    target: { requestedUrl: url.toString(), finalUrl: url.toString() },
    metadata: {
      sourceName: 'GitHub REST Search API',
      sourceUrl: 'https://docs.github.com/en/rest/search/search',
      query,
      returnedRepositories: repositories.length,
      incompleteResults: Boolean(payload.incomplete_results),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
      rateLimitReset: response.headers.get('x-ratelimit-reset')
    },
    research: {
      methodology: 'Repositories are returned by GitHub REST Search sorted by last update. Growth Velocity Index is the positive star-count change observed by this site between snapshots, scaled to a 24-hour rate. A baseline observation cannot calculate velocity.',
      valueStatement: 'מדד מגמות וסיווג קטגוריות טכנולוגיות על בסיס נתוני מחקר פתוחים מ-GitHub API.',
      repositories
    }
  };
}

export async function runGitHubOpenResearch() {
  if (String(process.env.SOURCE_PERMISSION_CONFIRMED).toLowerCase() !== 'true') throw new Error('SOURCE_PERMISSION_CONFIRMED=true is required for the declared open research source.');
  const research = await fetchGitHubResearch();
  await setCachedScrape(research, { ttlSeconds: Number.parseInt(process.env.CACHE_TTL_SECONDS ?? '86400', 10) });
  return research;
}
