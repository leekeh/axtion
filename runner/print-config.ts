/**
 * Print the configuration for the accessibility check.
 */
import { readFileSync } from "node:fs";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const row = (label: string, value: string) =>
  console.log(`  ${bold(label.padEnd(14))}  ${value}`);

const baseUrl = process.env.BASE_URL ?? "";
const browser = process.env.A11Y_BROWSER ?? "";
const workers = process.env.A11Y_WORKERS ?? "";
const waitStrategy = process.env.A11Y_WAIT_STRATEGY ?? "";
const manifestPath = process.env.MANIFEST_PATH ?? "";
const rules = process.env.A11Y_RULES ?? "";
const rulesets = process.env.A11Y_RULESETS ?? "";
const disabledRules = process.env.A11Y_DISABLED_RULES ?? "";
const exclusions = process.env.A11Y_EXCLUSIONS ?? "";

let routeCount = "?";
let routes: string[] = [];
try {
  const manifest: Array<string | { path: string }> = JSON.parse(
    readFileSync(manifestPath, "utf-8"),
  );
  routeCount = String(manifest.length);
  routes = manifest.map((item) =>
    typeof item === "string" ? item : item.path,
  );
} catch {}

row("Base URL", baseUrl);
row("Browser", browser);
row("Workers", workers);
row("Wait strategy", waitStrategy);
row("Routes", routeCount);
if (rules) row("Rules", rules);
if (rulesets) row("Rulesets", rulesets);
if (disabledRules) row("Disabled rules", disabledRules);
if (exclusions && exclusions !== "[]") row("Exclusions", exclusions);

console.log("");
for (const route of routes) {
  console.log(`  \x1b[1;35m\u00b7\x1b[0m ${route}`);
}
console.log("");
