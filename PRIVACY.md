# Privacy Notice

## What data this action accesses

When you use this action in a workflow, the following data is accessed or processed:

| Data | Purpose |
|------|---------|
| GitHub token (`github.token` or a supplied token) | Post or update a PR comment with test results via the GitHub Issues API |
| Pull request metadata (PR number, repo owner/name) | Identify the correct PR to comment on |
| HTML content of the URLs under test | Passed to axe-core running inside the GitHub Actions runner for accessibility analysis |

## How data is handled

- **No data is sent to any external service.** All processing happens inside the GitHub Actions runner on GitHub's own infrastructure.
- **No data is stored beyond the workflow run.** The only persistent output is the PR comment written back to GitHub (via GitHub's own API) and any HTML report artifacts uploaded to GitHub Actions — both of which remain within your repository.
- **The GitHub token** is used solely to post the PR comment and is never logged or transmitted elsewhere.

## Third-party libraries

The runner uses [axe-core](https://github.com/dequelabs/axe-core) (Deque Systems) and [Playwright](https://playwright.dev/) (Microsoft) to perform accessibility tests locally. Neither library transmits page content or results to external servers.

## Contact

If you have questions or concerns about privacy, contact [hello@leekeh.com](mailto:hello@leekeh.com).
