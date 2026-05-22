import { defineConfig, devices, type Project } from "@playwright/test";

const browser = process.env.A11Y_BROWSER ?? "chromium";
const workers = Number.parseInt(process.env.A11Y_WORKERS ?? "2", 10);
const resultsFile = process.env.A11Y_RESULTS_FILE;
/**
 * Map browser name to Playwright device descriptor.
 * Users can specify chromium, firefox, or webkit.
 */
const browserDeviceMap: Record<string, Project["use"]> = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
};

const deviceConfig = browserDeviceMap[browser] ?? browserDeviceMap["chromium"];

// Use import.meta.dirname so test discovery works regardless of process.cwd()
const runnerDir = new URL(".", import.meta.url).pathname;

export default defineConfig({
  testDir: runnerDir,
  testMatch: "a11y.spec.ts",
  fullyParallel: true,
  workers,
  timeout: 120_000,
  retries: 0,
  reporter: resultsFile
    ? [["list"], ["json", { outputFile: resultsFile }]]
    : [["line"]],
  forbidOnly: !!process.env.CI,

  use: {
    baseURL: process.env.BASE_URL,
    // Reduce motion to avoid animation-related false positives
    contextOptions: {
      reducedMotion: "reduce",
    },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: browser,
      use: { ...deviceConfig },
    },
  ],
});
