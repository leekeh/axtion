/**
 * Install dependencies and run the main orchestrator for the a11y check action.
 */
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

// ─── 1. Install runner dependencies ──────────────────────────────────────────

execFileSync(
  process.execPath,
  ["--experimental-strip-types", join(__dirname, "print-header.ts"), "📦  Installing dependencies"],
  { stdio: "inherit", env: process.env },
);

try {
  execFileSync("pnpm", ["install", "--frozen-lockfile"], {
    stdio: "inherit",
    cwd: __dirname,
  });
} catch (err) {
  process.exit(err.status ?? 1);
}

// ─── 2. Run the orchestrator ──────────────────────────────────────────────────

try {
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", join(__dirname, "main.ts")],
    { stdio: "inherit", env: process.env },
  );
} catch (err) {
  process.exit(err.status ?? 1);
}
