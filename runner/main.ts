/**
 * Orchestrates the full accessibility check workflow.
 *
 * Runs as the sole entry point of the node24 JavaScript action via boot.cjs.
 * Being a JavaScript action (not a composite action step) gives us direct
 * access to ACTIONS_RUNTIME_TOKEN, which @actions/artifact requires to upload
 * unarchived, browser-viewable per-route artifacts.
 */
import * as core from "@actions/core";
import { DefaultArtifactClient } from "@actions/artifact";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Inputs ──────────────────────────────────────────────────────────────────

const baseUrl              = core.getInput("base-url", { required: true });
const routesInput          = core.getInput("routes");
const routesFileInput      = core.getInput("routes-file");
const browser              = core.getInput("browser")        || "chromium";
const workers              = core.getInput("workers")        || "2";
const waitStrategy         = core.getInput("wait-strategy")  || "networkidle";
const exclusions           = core.getInput("exclusions")     || "[]";
const rules                = core.getInput("rules");
const rulesets             = core.getInput("rulesets");
const disabledRules        = core.getInput("disabled-rules");
const generateReport       = core.getInput("generate-report") !== "false";
const shouldPostComment    = core.getInput("post-comment")    !== "false";
const githubToken          = core.getInput("github-token");
const commentTemplateSuccess = core.getInput("comment-template-success");
const commentTemplateFailure = core.getInput("comment-template-failure");

// ─── Paths ───────────────────────────────────────────────────────────────────

const GITHUB_WORKSPACE  = process.env.GITHUB_WORKSPACE!;
const RUNNER_TEMP       = process.env.RUNNER_TEMP!;
const GITHUB_RUN_ID     = process.env.GITHUB_RUN_ID!;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY!;
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME;
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

const reportDir        = path.join(GITHUB_WORKSPACE, "a11y-reports");
const resultsFile      = path.join(RUNNER_TEMP, "a11y-results.json");
const artifactUrlsFile = path.join(RUNNER_TEMP, "a11y-artifact-urls.json");
const manifestPath     = path.join(RUNNER_TEMP, "a11y-routes.json");
const actionDir        = path.resolve(__dirname, "..");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Spawn a TypeScript runner script via --experimental-strip-types. */
function runTs(
  script: string,
  args: string[] = [],
  env: Record<string, string | undefined> = {},
): void {
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", path.join(__dirname, script), ...args],
    { stdio: "inherit", env: { ...process.env, ...env } },
  );
}

function header(msg: string): void {
  runTs("print-header.ts", [msg]);
}

// ─── 1. Install Playwright browser ───────────────────────────────────────────

// Validate browser choice before attempting the playwright install.
const VALID_BROWSERS = ["chromium", "firefox", "webkit"] as const;
if (!(VALID_BROWSERS as readonly string[]).includes(browser)) {
  core.setFailed(
    `Invalid browser '${browser}'. Must be chromium, firefox, or webkit.`,
  );
  process.exit(1);
}

header("🎧  Installing Playwright browser");
execFileSync("pnpm", ["exec", "playwright", "install", browser], {
  stdio: "inherit",
  cwd: __dirname,
});

// ─── 2. Prepare configuration ─────────────────────────────────────────────────

header("⚙️  Preparing configuration");

if (routesFileInput) {
  // Guard against path traversal: the resolved path must stay within GITHUB_WORKSPACE.
  const resolved  = path.normalize(path.resolve(routesFileInput));
  const workspace = path.normalize(path.resolve(GITHUB_WORKSPACE));
  if (resolved !== workspace && !resolved.startsWith(workspace + path.sep)) {
    core.setFailed(
      `routes-file '${routesFileInput}' must be a path within GITHUB_WORKSPACE.`,
    );
    process.exit(1);
  }
  writeFileSync(manifestPath, readFileSync(resolved));
} else if (routesInput) {
  writeFileSync(manifestPath, routesInput);
} else {
  core.setFailed("Either the 'routes' or 'routes-file' input is required.");
  process.exit(1);
}

const sharedEnv: Record<string, string> = {
  BASE_URL:           baseUrl,
  A11Y_BROWSER:       browser,
  A11Y_WORKERS:       workers,
  A11Y_WAIT_STRATEGY: waitStrategy,
  A11Y_EXCLUSIONS:    exclusions,
  ...(rules         ? { A11Y_RULES:          rules }         : {}),
  ...(rulesets      ? { A11Y_RULESETS:        rulesets }      : {}),
  ...(disabledRules ? { A11Y_DISABLED_RULES:  disabledRules } : {}),
};

runTs("print-config.ts",         [], { ...sharedEnv, MANIFEST_PATH: manifestPath });
runTs("print-resolved-rules.ts", [], sharedEnv);

// ─── 3. Run tests ─────────────────────────────────────────────────────────────

header("🧪  Running tests");

// Playwright handles TypeScript via its own esbuild transform, so we do NOT
// set NODE_OPTIONS=--experimental-strip-types for this subprocess.
const testResult = spawnSync(
  path.join(__dirname, "node_modules/.bin/playwright"),
  ["test", "--config", path.join(__dirname, "playwright.config.ts")],
  {
    stdio:  "inherit",
    cwd:    GITHUB_WORKSPACE,
    env: {
      ...process.env,
      ...sharedEnv,
      ROUTES_FILE:          manifestPath,
      A11Y_GENERATE_REPORT: generateReport ? "true" : "false",
      A11Y_REPORT_DIR:      "a11y-reports",
      A11Y_RESULTS_FILE:    resultsFile,
    },
  },
);

const playwrightFailed = (testResult.status ?? 1) !== 0;

header("📊  Results");
runTs("print-results.ts", [], {
  A11Y_PLAYWRIGHT_EXIT: String(testResult.status ?? 1),
});

// ─── 4. Upload per-route HTML reports ─────────────────────────────────────────

let runUrl: string | undefined;

if (playwrightFailed && generateReport && existsSync(reportDir)) {
  const htmlFiles = readdirSync(reportDir).filter((f) => f.endsWith(".html"));

  if (htmlFiles.length > 0) {
    header("📊  Creating output");

    const [owner, repo]                    = GITHUB_REPOSITORY.split("/");
    const client                           = new DefaultArtifactClient();
    const urlMap: Record<string, string>   = {};

    // @actions/artifact writes "Artifact name is valid!" etc. to stdout for
    // every file. Suppress those lines to keep the log readable.
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (typeof chunk === "string" && / is valid!/.test(chunk)) return true;
      return (origWrite as unknown as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as unknown as typeof process.stdout.write;

    for (const file of htmlFiles) {
      const { id } = await client.uploadArtifact(
        file,
        [path.join(reportDir, file)],
        reportDir,
        { skipArchive: true },
      );
      if (id !== undefined) {
        urlMap[file] =
          `https://github.com/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}/artifacts/${id}`;
        origWrite(`  · ${file} → ${urlMap[file]}\n`);
      }
    }

    process.stdout.write = origWrite as typeof process.stdout.write;
    writeFileSync(artifactUrlsFile, JSON.stringify(urlMap));
    runUrl = `https://github.com/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}`;
  }
}

// ─── 5. Set outputs ───────────────────────────────────────────────────────────

core.setOutput("violations-found", playwrightFailed ? "true" : "false");
core.setOutput("report-url",       runUrl ?? "");

// ─── 6. Post PR comment ───────────────────────────────────────────────────────

if (shouldPostComment && GITHUB_EVENT_NAME === "pull_request") {
  const event = GITHUB_EVENT_PATH
    ? (JSON.parse(readFileSync(GITHUB_EVENT_PATH, "utf-8")) as Record<string, unknown>)
    : {};
  const prNumber = String(
    (event.pull_request as Record<string, unknown> | undefined)?.number ?? "",
  );

  try {
    runTs("post-comment.ts", [], {
      GH_TOKEN:                githubToken       || undefined,
      GITHUB_PR_NUMBER:        prNumber,
      A11Y_OUTCOME:            playwrightFailed ? "failure" : "success",
      REPORT_URL:              runUrl            ?? "",
      ARTIFACT_URLS_FILE:      artifactUrlsFile,
      REPORT_DIR:              reportDir,
      RESULTS_FILE:            resultsFile,
      CUSTOM_TEMPLATE_SUCCESS: commentTemplateSuccess || undefined,
      CUSTOM_TEMPLATE_FAILURE: commentTemplateFailure || undefined,
      ACTION_PATH:             actionDir,
    });
  } catch (err) {
    core.warning(`Failed to post PR comment: ${err}`);
  }
}

// ─── 7. Fail if violations found ─────────────────────────────────────────────

if (playwrightFailed) {
  process.exit(1);
}
