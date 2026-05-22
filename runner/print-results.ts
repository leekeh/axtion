/**
 * Prints the results of the accessibility tests to stdout.
 */
import { readFileSync, existsSync } from 'node:fs';

const exitCode    = Number(process.env.A11Y_PLAYWRIGHT_EXIT ?? '0');
const resultsFile = process.env.A11Y_RESULTS_FILE ?? '';

if (exitCode === 0) {
  console.log('  \u2705  No accessibility issues detected\n\n');
} else {
  console.log('  \u274c  The following tests failed:\n\n');
  if (resultsFile && existsSync(resultsFile)) {
    try {
      const data = JSON.parse(readFileSync(resultsFile, 'utf-8'));
      const lines: string[] = [];

      const walk = (suites: any[]) => {
        for (const suite of suites ?? []) {
          walk(suite.suites ?? []);
          for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
              for (const result of test.results ?? []) {
                if (result.status === 'failed' || result.status === 'timedOut') {
                  const suffix = result.status === 'timedOut' ? ' (timed out)' : '';
                  lines.push(`  \u00b7 ${spec.title}${suffix}`);
                }
              }
            }
          }
        }
      };
      walk(data.suites ?? []);

      for (const line of new Set(lines)) {
        console.log(line);
      }
    } catch {}
  }
  console.log('\n');
}
