import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  buildEngineeringEnvironment,
  ensurePrivateDirectory,
  readProtected,
  resolveEngineeringRuntimePaths,
} from "./openclaw-engineering-runtime.mjs";

const paths = resolveEngineeringRuntimePaths();

function gatewayIsHealthy(env) {
  return (
    spawnSync(paths.openclawBinary, ["gateway", "health"], {
      encoding: "utf8",
      env,
      stdio: "ignore",
    }).status === 0
  );
}

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function startEngineeringGateway() {
  if (process.platform !== "darwin") {
    throw new Error(
      "The engineering gateway launcher only runs on the Mac mini.",
    );
  }
  for (const path of [
    paths.openclawBinary,
    paths.configPath,
    paths.gatewayTokenPath,
    paths.activationPath,
  ]) {
    if (!existsSync(path)) {
      throw new Error("The isolated engineering activation is incomplete.");
    }
  }

  const env = buildEngineeringEnvironment(
    paths,
    readProtected(paths.gatewayTokenPath, "Engineering gateway token"),
  );
  if (gatewayIsHealthy(env)) {
    console.log("Sanctuary engineering gateway: READY (already running)");
    return;
  }

  ensurePrivateDirectory(dirname(paths.pidPath));
  ensurePrivateDirectory(dirname(paths.logPath));
  const log = openSync(paths.logPath, "a", 0o600);
  const child = spawn(
    "/usr/bin/caffeinate",
    ["-dimsu", paths.openclawBinary, "gateway", "run", "--compact"],
    {
      detached: true,
      env,
      stdio: ["ignore", log, log],
    },
  );
  child.unref();
  closeSync(log);
  writeFileSync(paths.pidPath, `${child.pid}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(paths.pidPath, 0o600);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    wait(500);
    if (gatewayIsHealthy(env)) {
      console.log(`Sanctuary engineering gateway: READY (pid ${child.pid})`);
      return;
    }
  }
  throw new Error(`Gateway did not become healthy; inspect ${paths.logPath}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    startEngineeringGateway();
  } catch (error) {
    console.error(`Sanctuary engineering gateway: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
