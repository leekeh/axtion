// Entry point for the node24 JavaScript action.
//
// Runs pnpm install BEFORE spawning main.ts because main.ts is an ESM module
// whose imports (@actions/core, @actions/artifact, …) are resolved at startup
// before any code executes. Without a prior install the runtime throws
// ERR_MODULE_NOT_FOUND immediately.
//
// Re-spawns Node.js with --experimental-strip-types so the orchestrator
// (main.ts) can be written in TypeScript like the rest of the runner scripts.
// process.env is forwarded explicitly, which ensures ACTIONS_RUNTIME_TOKEN
// (required by @actions/artifact) is available to the child process.
const { execFileSync } = require("child_process");
const { join } = require("path");

// ─── 1. Install runner dependencies ──────────────────────────────────────────
// boot.cjs uses only Node.js built-ins so it needs no node_modules itself.

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
