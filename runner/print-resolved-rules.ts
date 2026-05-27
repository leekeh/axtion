/**
 * Resolves the applied rules and prints them to stdout.
 */
import axe from "axe-core";
import { styleText } from "node:util";

const parseArr = (s: string | undefined): string[] | null => {
  if (!s) return null;

  try {
    const parsed: unknown = JSON.parse(s);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : null;
  } catch {
    return null;
  }
};

const withRules = parseArr(process.env.A11Y_RULES);
const withTags = parseArr(process.env.A11Y_RULESETS);
const disableRules = parseArr(process.env.A11Y_DISABLED_RULES) ?? [];

const activeTags = withRules ? undefined : (withTags ?? undefined);
let rules = axe.getRules(activeTags);
if (withRules) rules = rules.filter((r) => withRules.includes(r.ruleId));
rules = rules.filter((r) => !disableRules.includes(r.ruleId));

console.log(`  ${styleText("bold", "Resolved rules")}\n`);

if (!rules.length) {
  console.log("  (no rules match the configuration)\n");
  process.exit(0);
}

const width = Math.max(...rules.map((r) => r.ruleId.length));
for (const r of rules.toSorted((a, b) => a.ruleId.localeCompare(b.ruleId))) {
  console.log(
    `  ${styleText(["bold", "magenta"], "\u00b7")} ${r.ruleId.padEnd(width)}  ${r.description}`,
  );
}
console.log("");
