// Compatibility entrypoint: the scheduled collector uses GitHub REST API research, not browser scraping.
import { runGitHubOpenResearch } from './githubResearch.js';

export { fetchGitHubResearch, runGitHubOpenResearch } from './githubResearch.js';

async function main() {
  const research = await runGitHubOpenResearch();
  console.info(JSON.stringify({ status: 'stored', timestamp: research.timestamp, repositories: research.research.repositories.length }));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
