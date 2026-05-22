/**
 * Uploads each HTML report as a separate unarchived artifact so the files can
 * be viewed directly in the browser (no zip download required).
 *
 * Writes a JSON map of { filename → artifact URL } to ARTIFACT_URLS_FILE and
 * appends `run-url` to GITHUB_OUTPUT for use in action outputs.
 */
import { DefaultArtifactClient } from "@actions/artifact";
import {
  readdirSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";

const reportDir = process.env.REPORT_DIR!;
const outputFile = process.env.ARTIFACT_URLS_FILE!;
const githubOutput = process.env.GITHUB_OUTPUT!;
const runId = process.env.GITHUB_RUN_ID!;
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");

const client = new DefaultArtifactClient();

const files = readdirSync(reportDir).filter((f) => f.endsWith(".html"));
const urlMap: Record<string, string> = {};

for (const file of files) {
  const filePath = path.join(reportDir, file);
  const { id } = await client.uploadArtifact(file, [filePath], reportDir, {
    skipArchive: true,
  });
  if (id !== undefined) {
    urlMap[file] = `https://github.com/${owner}/${repo}/actions/runs/${runId}/artifacts/${id}`;
    console.log(`  · ${file} → ${urlMap[file]}`);
  }
}

writeFileSync(outputFile, JSON.stringify(urlMap));

const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
appendFileSync(githubOutput, `run-url=${runUrl}\n`);
