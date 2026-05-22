/**
 * Generates a single self-contained HTML report combining all per-route
 * violations. Each route gets an anchored section so the PR comment can
 * link directly to it: `${artifactUrl}#${safeName}`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const reportDir = process.env.REPORT_DIR!;
const indexFile = process.env.INDEX_FILE!;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const bases = readdirSync(reportDir)
  .filter((f) => f.endsWith(".violations.json"))
  .map((f) => f.replace(/\.violations\.json$/, ""))
  .sort();

function routeDisplayName(base: string): string {
  let name = base.replaceAll("_", " ").trim();
  try {
    const meta = JSON.parse(
      readFileSync(path.join(reportDir, `${base}.meta.json`), "utf-8"),
    );
    if (meta.name) name = meta.name;
  } catch {}
  return name;
}

const nav = bases
  .map(
    (base) =>
      `<li><a href="#${base}">${escapeHtml(routeDisplayName(base))}</a></li>`,
  )
  .join("\n      ");

const sections = bases
  .map((base) => {
    const name = routeDisplayName(base);

    let pageUrl = "";
    try {
      const meta = JSON.parse(
        readFileSync(path.join(reportDir, `${base}.meta.json`), "utf-8"),
      );
      if (meta.url) pageUrl = meta.url;
    } catch {}

    let violations: any[] = [];
    try {
      violations = JSON.parse(
        readFileSync(
          path.join(reportDir, `${base}.violations.json`),
          "utf-8",
        ),
      );
    } catch {}

    const violationsHtml =
      violations.length === 0
        ? '<p class="no-violations">✅ No violations found.</p>'
        : violations
            .map((v) => {
              const impact: string = v.impact ?? "minor";
              const nodes = (v.nodes ?? [])
                .map(
                  (n: any) => `
            <li class="node">
              <code>${escapeHtml(n.html ?? "")}</code>
              <p class="target">${escapeHtml((n.target ?? []).join(", "))}</p>
              <p class="summary">${escapeHtml(n.failureSummary ?? "")}</p>
            </li>`,
                )
                .join("");
              return `
        <div class="rule">
          <div class="rule-header">
            <span class="badge ${impact}">${impact}</span>
            <a href="${escapeHtml(v.helpUrl ?? "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.id ?? "")}</a>
            <span class="rule-desc">${escapeHtml(v.help ?? "")}</span>
          </div>
          <ul class="nodes">${nodes}
          </ul>
        </div>`;
            })
            .join("");

    const urlLine = pageUrl
      ? `<a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageUrl)}</a> · `
      : "";
    const count = violations.length;

    return `
  <section id="${base}">
    <h2>${escapeHtml(name)}</h2>
    <p class="meta">${urlLine}${count} violation rule${count !== 1 ? "s" : ""}</p>
    ${violationsHtml}
  </section>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Axtion Accessibility Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 1.5rem 2rem; color: #1f2328; line-height: 1.5; }
    a { color: #0969da; }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; }
    nav { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 2rem; }
    nav ul { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    nav li a { padding: 0.2rem 0.75rem; background: #fff; border: 1px solid #d0d7de; border-radius: 20px; text-decoration: none; font-size: 0.875rem; }
    nav li a:hover { background: #ddf4ff; border-color: #54aeff; }
    section { margin-bottom: 3rem; }
    h2 { font-size: 1.125rem; border-bottom: 1px solid #d0d7de; padding-bottom: 0.4rem; margin: 2rem 0 0.25rem; }
    .meta { font-size: 0.8rem; color: #636c76; margin: 0 0 1rem; }
    .rule { margin-bottom: 1.25rem; }
    .rule-header { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.4rem; font-size: 0.875rem; flex-wrap: wrap; }
    .rule-desc { color: #636c76; }
    .badge { padding: 1px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
    .critical { background: #ffdcd7; color: #a40e26; }
    .serious  { background: #ffd8b5; color: #953b00; }
    .moderate { background: #fff4c2; color: #7d5c00; }
    .minor    { background: #ddf4ff; color: #0550ae; }
    .nodes { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .node { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 0.625rem 0.75rem; font-size: 0.8rem; }
    .node code { display: block; font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-all; color: #1f2328; }
    .target { margin: 0.3rem 0 0; color: #636c76; font-family: ui-monospace, "SFMono-Regular", Consolas, monospace; font-size: 0.75rem; }
    .summary { margin: 0.3rem 0 0; color: #57606a; white-space: pre-wrap; }
    .no-violations { color: #1a7f37; }
  </style>
</head>
<body>
  <h1>🔍 Axtion Accessibility Report</h1>
  <nav><ul>
      ${nav}
  </ul></nav>
  ${sections}
</body>
</html>`;

writeFileSync(indexFile, html);
console.log(
  `  · Created ${indexFile} (${bases.length} route${bases.length !== 1 ? "s" : ""})`,
);
