import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const buildFirst = process.argv.includes("--build");
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const env = {
  ...process.env,
  PORTAL_OFFLINE_SHELL_REQUIRED: "1",
  PORTAL_PLAYWRIGHT_DIST_DIR:
    process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() ||
    ".next/playwright-fixture",
  PORTAL_PLAYWRIGHT_PRODUCTION: "1",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath) {
    run(process.execPath, [npmExecPath, ...args]);
    return;
  }

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  run(command, args, { shell: process.platform === "win32" });
}

if (buildFirst) runNpm(["run", "build:portal"]);
runNpm(["run", "portal:auth-env"]);
run(process.execPath, [
  playwrightCli,
  "test",
  "playwright/portal.offline-shell.spec.ts",
  "--project=portal-chromium",
  "--workers=1",
]);
