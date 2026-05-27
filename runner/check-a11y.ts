import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createHtmlReport } from "axe-html-reporter";
import { mkdirSync, writeFileSync } from "node:fs";

const generateReport = process.env.A11Y_GENERATE_REPORT !== "false";
const reportDir = process.env.A11Y_REPORT_DIR ?? "a11y-reports";
const exclusions = parseJsonArray(process.env.A11Y_EXCLUSIONS ?? "[]");
const rules = parseJsonArray(process.env.A11Y_RULES);
const rulesets = parseJsonArray(process.env.A11Y_RULESETS);
const disabledRules = parseJsonArray(process.env.A11Y_DISABLED_RULES);

/**
 * Runs axe-core on the given page and asserts no violations.
 * Generates an HTML report for any violations found (when generate-report is enabled).
 * The testName is used to produce a human-readable report filename and metadata.
 */
export async function checkA11y(page: Page, testName: string): Promise<void> {
  let builder = new AxeBuilder({ page });

  for (const selector of exclusions) {
    builder = builder.exclude([selector]);
  }

  if (rules.length > 0) builder = builder.withRules(rules);
  if (rulesets.length > 0) builder = builder.withTags(rulesets);
  if (disabledRules.length > 0) builder = builder.disableRules(disabledRules);

  const results = await builder.analyze();

  if (results.violations.length > 0 && generateReport) {
    mkdirSync(reportDir, { recursive: true });
    const safeName = toSafeName(testName);
    createHtmlReport({
      results,
      options: {
        outputDir: reportDir,
        reportFileName: `${safeName}.html`,
      },
    });
    writeFileSync(
      `${reportDir}/${safeName}.meta.json`,
      JSON.stringify({ name: testName, url: page.url() }),
    );
    writeFileSync(
      `${reportDir}/${safeName}.violations.json`,
      JSON.stringify(results.violations),
    );
  }

  expect(results.violations).toEqual([]);
}

function toSafeName(name: string): string {
  return (
    name
      .replaceAll(/[^a-zA-Z0-9 _-]/g, "_")
      .replaceAll(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "") || "report"
  );
}


function parseJsonArray(envVar: string | undefined): string[] {
  if (!envVar) return [];
  try {
    const parsed = JSON.parse(envVar);
    if (Array.isArray(parsed))
      return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // ignore malformed input
  }
  return [];
}
