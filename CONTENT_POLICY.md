# Content, Source, and Monetization Policy

This repository is configured for a single, declared source. The site owner may run the scraper only against a source that is publicly accessible **and** that the owner is authorized to access and republish or excerpt. The starter `TARGET_URL` is a test target; replacing it requires a fresh authorization check by the site owner.

## Publishing rules

The generator publishes a timestamped, source-linked excerpt rather than a complete republication of scraped text. Each page identifies the original source and links to it. The site stays non-indexable by default. Indexing can be enabled only by setting `SOURCE_PERMISSION_CONFIRMED=true`, `ENABLE_SEARCH_INDEXING=true`, and a non-empty `ORIGINAL_VALUE_STATEMENT` in repository configuration. The statement should describe the user-facing value added beyond copying a source, such as a documented comparison, original analysis, data-quality annotation, or a useful navigable feature.

## Monetization rules

PayPal support, advertising, and affiliate placements are visually separated from content. A support link is optional and does not promise a product or financial outcome. Affiliate links must use `rel="sponsored nofollow noopener noreferrer"` and a clear disclosure. Advertising may be enabled only after the publisher obtains the relevant provider approval and follows its current policies. The project never asks visitors to click ads or attempts to generate artificial traffic.

## Limits and review

Automation does not guarantee indexing, traffic, advertising approval, affiliate acceptance, or revenue. The site owner remains responsible for verifying source permissions, data accuracy, local law, privacy obligations, affiliate-program terms, and advertising-program requirements. Remove or disable a source promptly if permission changes or a legitimate complaint is received.

## References

[1]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search spam policies"
[2]: https://support.google.com/adsense/answer/48182?hl=en "AdSense Program policies"
[3]: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking "FTC Endorsement Guides"
