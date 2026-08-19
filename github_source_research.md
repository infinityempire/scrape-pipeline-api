# GitHub source assessment

## Decision

Do not use `https://github.com/trending` as a scraped commercial-content source. Use of the GitHub web page would be scraping; GitHub distinguishes its API from scraping. More importantly, GitHub's acceptable-use policy limits use of Service information, whether accessed by API or otherwise, to specified purposes such as open-access research or archiving, and separately prohibits use of Service information for spam. A monetized trend site based on GitHub repository data needs written permission or a source with commercial-reuse terms that clearly cover the planned use.

## Technical alternative for permitted research or archival use

For a non-commercial, open-access research view, use the GitHub REST Search API rather than scraping the Trending page. The API supports repository search and documented search limits. A GitHub Actions `GITHUB_TOKEN` has a documented per-repository rate limit, and the pipeline should use a single request, request only public repository metadata, store snapshots, and back off on rate-limit responses.

## Sources

1. https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28
2. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
3. https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
