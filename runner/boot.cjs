// Entry point for the node24 JavaScript action.
// Re-spawns Node.js with --experimental-strip-types so the orchestrator
// (main.ts) can be written in TypeScript like the rest of the runner scripts.
// process.env is forwarded explicitly, which ensures ACTIONS_RUNTIME_TOKEN
// (required by @actions/artifact) is available to the child process.
const { execFileSync } = require("child_process");
const { join } = require("path");

try {
  execFileSync(
    process.execPath,
    ["--experimental-strip-types", join(__dirname, "main.ts")],
    { stdio: "inherit", env: process.env },
  );
} catch (err) {
  process.exit(err.status ?? 1);
}
