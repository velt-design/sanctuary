import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";

const home = homedir();
const stateDir = join(home, ".openclaw");
const configPath = join(stateDir, "openclaw.json");
const tokenPath = join(stateDir, "credentials", "gateway-token");
const openclawBinary = join(home, ".local", "bin", "openclaw");
const pidPath = join(stateDir, "run", "gateway-caffeinate.pid");
const logPath = join(stateDir, "logs", "gateway.log");

function environment() {
  return {
    ...process.env,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_TOKEN: readFileSync(tokenPath, "utf8").trim(),
    OPENCLAW_STATE_DIR: stateDir,
    PATH: `${join(home, "bin")}:${join(home, ".local", "bin")}:${process.env.PATH ?? ""}`,
  };
}

function gatewayIsHealthy(env) {
  const probe = spawnSync(openclawBinary, ["gateway", "health"], {
    encoding: "utf8",
    env,
    stdio: "ignore",
  });
  return probe.status === 0;
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("The headless gateway launcher only runs on the Mac mini.");
  }
  if (!existsSync(openclawBinary) || !existsSync(configPath) || !existsSync(tokenPath)) {
    throw new Error("OpenClaw development activation is incomplete.");
  }

  const env = environment();
  if (gatewayIsHealthy(env)) {
    console.log("OpenClaw headless gateway: READY (already running)");
    return;
  }

  mkdirSync(dirname(pidPath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
  const log = openSync(logPath, "a", 0o600);
  const child = spawn(
    "/usr/bin/caffeinate",
    ["-dimsu", openclawBinary, "gateway", "run", "--compact"],
    {
      detached: true,
      env,
      stdio: ["ignore", log, log],
    },
  );
  child.unref();
  closeSync(log);
  writeFileSync(pidPath, `${child.pid}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(pidPath, 0o600);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    wait(500);
    if (gatewayIsHealthy(env)) {
      console.log(`OpenClaw headless gateway: READY (pid ${child.pid})`);
      return;
    }
  }
  throw new Error(`Gateway did not become healthy; inspect ${logPath}.`);
}

try {
  main();
} catch (error) {
  console.error(`OpenClaw headless gateway: ERROR — ${error.message}`);
  process.exitCode = 1;
}
