/**
 * Uploads each HTML report as a separate unarchived artifact so each route
 * can be viewed directly in the browser without downloading a zip.
 *
 * Reads from env (set by the parent composite action step):
 *   REPORT_DIR            – directory containing the per-route HTML reports
 *   ARTIFACT_URLS_FILE    – path to write the { filename → url } JSON map to
 *
 * Writes to GITHUB_OUTPUT:
 *   run-url               – URL of the workflow run
 */
import { readdirSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { DefaultArtifactClient } from "@actions/artifact";

const reportDir = process.env.REPORT_DIR!;
const outputFile = process.env.ARTIFACT_URLS_FILE!;
const githubOutput = process.env.GITHUB_OUTPUT!;
const runId = process.env.GITHUB_RUN_ID!;
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");

const client = new DefaultArtifactClient();
const files = readdirSync(reportDir).filter((f) => f.endsWith(".html"));
const urlMap: Record<string, string> = {};

// Suppress the "…is valid!" informational messages @actions/artifact writes
// to stdout for every upload; keep everything else (errors, actual output).
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
  if (typeof chunk === "string" && / is valid!/.test(chunk)) return true;
  return (origWrite as unknown as (...a: unknown[]) => boolean)(chunk, ...rest);
}) as unknown as typeof process.stdout.write;

for (const file of files) {
  const filePath = path.join(reportDir, file);
  const { id } = await client.uploadArtifact(file, [filePath], reportDir, {
    skipArchive: true,
  });
  if (id !== undefined) {
    urlMap[file] = `https://github.com/${owner}/${repo}/actions/runs/${runId}/artifacts/${id}`;
    origWrite(`  · ${file} → ${urlMap[file]}\n`);
  }
}

process.stdout.write = origWrite as typeof process.stdout.write;

writeFileSync(outputFile, JSON.stringify(urlMap));

const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
appendFileSync(githubOutput, `run-url=${runUrl}\n`);
