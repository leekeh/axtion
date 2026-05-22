# Axtion - Axe-core + Playwright wrapped in a GitHub Action

Run [axe-core](https://github.com/dequelabs/axe-core#axe-core) accessibility tests against a running web app with [Playwright](https://playwright.dev/), and post results as a PR comment.

## Why?

On average, [57%](https://www.deque.com/automated-accessibility-coverage-report/) of accessibility issues can be detected with automated testing, and fixing them as early as possible saves time and effort. Use this action to quick-start your accessibility journey and catch regressions before they reach production. Add 4 lines to your testing workflow, and get a detailed report of accessibility violations with links to the exact failing elements and rules documentation.

## Quick start

```yaml
# In your workflow — after your app is built and started:
- uses: leekeh/axtion@92dac76ca6d585203df89b544d037392c325f9d8 # v 0.0.1
  with:
    base-url: http://localhost:3000
    routes: '["/", "/about", "/products"]'
```

## Permissions required

```yaml
permissions:
  pull-requests: write
  contents: read
```

## Inputs

### Required

| Input                       | Description                                                                |
| --------------------------- | -------------------------------------------------------------------------- |
| `base-url`                  | Base URL of the running app, e.g. `http://localhost:3000`                  |
| `routes` _or_ `routes-file` | Routes to test — provide exactly one. See [Routes format](#routes-format). |

### General

| Input           | Default       | Description                                                                         |
| --------------- | ------------- | ----------------------------------------------------------------------------------- |
| `browser`       | `chromium`    | Browser engine: `chromium`, `firefox`, or `webkit`                                  |
| `workers`       | `2`           | Number of parallel Playwright workers                                               |
| `wait-strategy` | `networkidle` | Default page-readiness strategy. See [Readiness strategies](#readiness-strategies). |
| `exclusions`    | `[]`          | JSON array of CSS selectors to exclude from axe scans                               |

### axe-core rule filtering

These inputs let you restrict or expand which [axe-core rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) are run. By default none of them are set, so axe-core's built-in defaults apply (WCAG 2.x AA + best-practice rules).

| Input            | Default | Description                                                                                                                                                                                                                             |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rulesets`       | —       | JSON array of rulesets associated with a specific standard that should be tested (e.g. `'["wcag2aa", "RGAAv4"]'`). See [axe-core tags](https://www.deque.com/axe/core-documentation/api-documentation/#axecore-tags) for the full list. |
| `rules`          | —       | JSON array of [rule IDs](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) to run exclusively. All other rules are skipped. E.g. `'["color-contrast", "image-alt"]'`                                         |
| `disabled-rules` | —       | JSON array of [rule IDs](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md) to disable. Everything else stays active. E.g. `'["color-contrast"]'`                                                             |

### Reporting & PR comments

| Input                      | Default               | Description                                                                 |
| -------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `generate-report`          | `true`                | Generate HTML reports for violations and upload as GitHub Actions artifacts |
| `post-comment`             | `true`                | Post/update a PR comment with results. Only runs on `pull_request` events.  |
| `github-token`             | `${{ github.token }}` | Token used for PR comments                                                  |
| `comment-template-success` | —                     | Path to a custom `.md` template for the success comment                     |
| `comment-template-failure` | —                     | Path to a custom `.md` template for the failure comment                     |

## Outputs

| Output             | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `violations-found` | `"true"` if any violations were found                                    |
| `report-url`       | URL to the uploaded artifact (empty if tests passed or reporting is off) |

## Routes format

Routes can be passed as either the `routes` input (inline JSON string) or via a file with `routes-file`.

### Simple array

```json
["/", "/about", "/search?q=bike"]
```

### With optional `name` and/or readiness strategy

Each route can be a string (uses the global `wait-strategy`) or an object. Only `path` is required:

```json
[
  "/",
  {
    "path": "/search?q=bike",
    "name": "Search results"
  },
  {
    "path": "/dashboard",
    "name": "Dashboard",
    "readiness": {
      "type": "selector",
      "selector": "#dashboard-content",
      "timeout": 5000
    }
  },
  {
    "path": "/app",
    "readiness": {
      "type": "js",
      "expression": "window.next !== undefined"
    }
  }
]
```

The `name` field sets the test name shown in logs and in the PR comment. When omitted, a name is derived from the path.

### Readiness strategies

| Type               | Description                                                            | Extra fields                                      |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| `networkidle`      | Wait until no network requests for 500ms _(default)_                   | —                                                 |
| `load`             | Wait for the `load` event                                              | —                                                 |
| `domcontentloaded` | Wait for `DOMContentLoaded`                                            | —                                                 |
| `selector`         | Wait for a CSS selector to be visible                                  | `selector` (required), `timeout` (ms, optional)   |
| `js`               | Poll a JS expression until truthy, then wait for `requestIdleCallback` | `expression` (required), `timeout` (ms, optional) |

The `js` strategy is ideal for **Next.js** apps: `"expression": "window.next !== undefined"` detects when client-side hydration has started.

## Custom comment templates

Override the default PR comment by providing a `.md` file with `{{variable}}` placeholders:

```markdown
## My Custom A11y Report

Status: {{status}}
Affected routes:
{{affected_routes}}
[Download reports]({{report_url}})
```

Available variables: `{{status}}`, `{{report_url}}`, `{{report_url_section}}`, `{{affected_routes}}`, `{{timed_out_section}}`, `{{repo}}`, `{{pr_number}}`

## Examples

### Run only WCAG 2.1 AA rules

```yaml
- uses: your-org/action-a11y-check@v1
  with:
    base-url: http://localhost:3000
    routes: '["/"]'
    rulesets: '["wcag21aa"]'
```

### Disable a specific rule

```yaml
- uses: your-org/action-a11y-check@v1
  with:
    base-url: http://localhost:3000
    routes: '["/"]'
    disabled-rules: '["color-contrast"]'
```

### Next.js app with custom readiness and named routes

```yaml
- uses: your-org/action-a11y-check@v1
  with:
    base-url: http://localhost:3000
    routes: |
      [
        "/",
        { "path": "/search", "name": "Search page" },
        {
          "path": "/products",
          "name": "Products",
          "readiness": { "type": "js", "expression": "window.next !== undefined" }
        }
      ]
```

### Using a routes file

```yaml
- uses: your-org/action-a11y-check@v1
  with:
    base-url: http://localhost:4321
    routes-file: tests/a11y/routes.json
    exclusions: '["iframe", ".expressive-code"]'
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE.md)
