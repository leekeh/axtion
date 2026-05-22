/**
 * Posts or updates a comment on the PR with the results of the accessibility check.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");
const reportDir = process.env.REPORT_DIR!;
const reportUrl = process.env.REPORT_URL;
const resultsFile = process.env.RESULTS_FILE;
const customSuccess = process.env.CUSTOM_TEMPLATE_SUCCESS;
const customFailure = process.env.CUSTOM_TEMPLATE_FAILURE;

const MARKER = "<!-- a11y-check-results -->";

try {
  const prNumber = process.env.GITHUB_PR_NUMBER;
  if (!prNumber || Number.isNaN(Number(prNumber))) {
    throw new Error("GITHUB_PR_NUMBER environment variable is not set");
  }

  let body: string;

  if (process.env.A11Y_OUTCOME === "success") {
    const tmpl = loadTemplate(customSuccess, "comment-success.md");
    body =
      MARKER +
      "\n" +
      render(tmpl, {
        status: "success",
        repo,
        pr_number: prNumber,
      });
  } else {
    const affectedRoutes =
      reportUrl || (reportDir && existsSync(reportDir))
        ? listInvalidRoutes()
        : "_(reports not generated)_";
    const timedOutSection = buildTimedOutSection();
    const tmpl = loadTemplate(customFailure, "comment-failure.md");
    body =
      MARKER +
      "\n" +
      render(tmpl, {
        status: "failure",
        report_url: reportUrl || "_(report unavailable)_",
        report_url_section: reportUrl
          ? `\n[📥 Download HTML reports](${reportUrl})\n`
          : "",
        affected_routes: affectedRoutes,
        timed_out_section: timedOutSection,
        repo,
        pr_number: prNumber,
      });
  }

  // Upsert the comment
  let existing: any = null;
  let page = 1;
  const perPage = 100;

  while (!existing) {
    const comments: any[] = await ghFetch(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=${perPage}&page=${page}`,
    );
    if (!comments.length) break;
    existing = comments.find((c) => c.body?.includes(MARKER));
    page++;
  }

  if (existing) {
    await ghFetch(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
    console.log(`Updated comment #${existing.id}\n`);
  } else {
    const created: any = await ghFetch(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    );
    console.log(`Created comment #${created.id}\n`);
  }
} catch (err) {
  if (err instanceof Error) {
    process.stderr.write(`Error preparing PR comment: ${err.message}\n`);
  } else {
    process.stderr.write(`Error preparing PR comment: ${String(err)}\n`);
  }
  process.exit(1);
}

async function ghFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<any> {
  const token = process.env.GH_TOKEN;
  if (!token) {
    throw new Error("GH_TOKEN environment variable is not set");
  }
  const url = `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

function listInvalidRoutes(): string {
  try {
    const files = readdirSync(reportDir).filter((f) => f.endsWith(".html"));
    if (!files.length) return "_No violation reports found._";
    return files
      .map((f) => {
        const base = f.replace(/\.html$/, "");
        let displayName = base.replaceAll("_", " ").trim();
        try {
          const meta = JSON.parse(
            readFileSync(path.join(reportDir, `${base}.meta.json`), "utf-8"),
          );
          if (meta.name) displayName = meta.name;
        } catch {}
        return `- ${displayName}`;
      })
      .join("\n");
  } catch {
    return "_Could not read report directory._";
  }
}

/**
 * Prepares a list of routes that timed out.
 */
function collectTimedOut(suites: any[]): string[] {
  const names: string[] = [];
  for (const suite of suites ?? []) {
    names.push(...collectTimedOut(suite.suites ?? []));
    for (const spec of suite.specs ?? []) {
      const timedOut = (spec.tests ?? []).some((t: any) =>
        (t.results ?? []).some((r: any) => r.status === "timedOut"),
      );
      if (timedOut) names.push(spec.title);
    }
  }
  return names;
}

function buildTimedOutSection(): string {
  if (!resultsFile || !existsSync(resultsFile)) return "";
  try {
    const data = JSON.parse(readFileSync(resultsFile, "utf-8"));
    const names = collectTimedOut(data.suites ?? []);
    if (!names.length) return "";
    const list = names.map((n) => `- ${n}`).join("\n");
    return `\n### ⏱️ Timed out\n\nThe following routes did not respond in time and were not checked:\n\n${list}\n`;
  } catch {
    return "";
  }
}

/**
 * Simple template rendering: replaces `{{var}}` with corresponding values from the vars object.
 */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function loadTemplate(
  customPath: string | undefined,
  defaultFile: string,
): string {
  if (customPath) {
    const workspace = process.env.GITHUB_WORKSPACE;
    if (!workspace) {
      throw new Error("GITHUB_WORKSPACE is not set; cannot resolve custom template path.");
    }
    const workspaceReal = path.resolve(workspace);
    const resolved = path.resolve(workspaceReal, customPath);
    if (resolved !== workspaceReal && !resolved.startsWith(workspaceReal + path.sep)) {
      throw new Error(`Template path escapes workspace: ${customPath}`);
    }
    try {
      return readFileSync(resolved, "utf-8");
    } catch (err) {
      process.stderr.write(
        `Warning: could not read custom template "${customPath}": ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
  const actionPath = process.env.ACTION_PATH ?? "";
  return readFileSync(path.join(actionPath, "templates", defaultFile), "utf-8");
}
