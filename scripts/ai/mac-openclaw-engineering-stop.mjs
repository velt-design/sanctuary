import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { userInfo } from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ENGINEERING_GATEWAY_PORT,
  assertDefaultAuthorityUnchanged,
  buildEngineeringEnvironment,
  fingerprintDefaultAuthority,
  readProtected,
  resolveEngineeringRuntimePaths,
} from "./openclaw-engineering-runtime.mjs";

function wait(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function parseEngineeringGatewayPid(value) {
  const text = String(value).trim();
  if (!/^[1-9][0-9]*$/.test(text)) {
    throw new Error("The isolated gateway PID file is invalid.");
  }
  const pid = Number.parseInt(text, 10);
  if (!Number.isSafeInteger(pid)) {
    throw new Error("The isolated gateway PID is outside the safe range.");
  }
  return pid;
}

function commandResult(binary, args) {
  return spawnSync(binary, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

export function inspectEngineeringGatewayProcess(
  pid,
  {
    currentUser = userInfo().username,
    port = ENGINEERING_GATEWAY_PORT,
    requireListener = true,
    run = commandResult,
  } = {},
) {
  const processResult = run("/bin/ps", [
    "-p",
    String(pid),
    "-o",
    "user=",
    "-o",
    "comm=",
  ]);
  if (processResult.status !== 0 || !processResult.stdout?.trim()) {
    return { running: false, pid };
  }
  const [owner, ...commandParts] = processResult.stdout.trim().split(/\s+/);
  const command = commandParts.join(" ");
  if (owner !== currentUser || command !== "openclaw-gateway") {
    throw new Error(
      "The PID file does not identify the current user's isolated OpenClaw gateway.",
    );
  }

  const listenerResult = run("/usr/sbin/lsof", [
    "-nP",
    "-a",
    "-p",
    String(pid),
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
  ]);
  if (listenerResult.status !== 0) {
    if (!requireListener) {
      return { running: true, pid, owner, command, port, listening: false };
    }
    throw new Error(
      `The recorded gateway process is not listening on isolated port ${port}.`,
    );
  }
  return { running: true, pid, owner, command, port };
}

function gatewayIsHealthy(paths, env) {
  return (
    spawnSync(paths.openclawBinary, ["gateway", "health"], {
      encoding: "utf8",
      env,
      stdio: "ignore",
    }).status === 0
  );
}

export function stopEngineeringGateway({
  platform = process.platform,
  paths = resolveEngineeringRuntimePaths(),
  fileExists = existsSync,
  readFile = readFileSync,
  removeFile = rmSync,
  inspectProcess = inspectEngineeringGatewayProcess,
  isHealthy = gatewayIsHealthy,
  signal = (pid) => process.kill(pid, "SIGTERM"),
  pause = wait,
  readGatewayToken = readProtected,
  fingerprintAuthority = fingerprintDefaultAuthority,
  assertAuthorityUnchanged = assertDefaultAuthorityUnchanged,
} = {}) {
  if (platform !== "darwin") {
    throw new Error(
      "The engineering gateway stop command only runs on the Mac mini.",
    );
  }
  const authorityBefore = fingerprintAuthority(paths);
  const token = readGatewayToken(
    paths.gatewayTokenPath,
    "Engineering gateway token",
  );
  const env = buildEngineeringEnvironment(paths, token);
  const healthy = isHealthy(paths, env);

  if (!fileExists(paths.pidPath)) {
    if (healthy) {
      throw new Error(
        "The isolated gateway is healthy but its owned PID file is missing; refusing an unbounded stop.",
      );
    }
    assertAuthorityUnchanged(paths, authorityBefore);
    console.log("Sanctuary engineering gateway: STOPPED (already stopped)");
    return { stopped: false, alreadyStopped: true, pid: null };
  }

  const pid = parseEngineeringGatewayPid(readFile(paths.pidPath, "utf8"));
  const processState = inspectProcess(pid);
  if (!processState.running) {
    if (healthy) {
      throw new Error(
        "The isolated gateway is healthy but the recorded process is absent; refusing an unbounded stop.",
      );
    }
    removeFile(paths.pidPath);
    assertAuthorityUnchanged(paths, authorityBefore);
    console.log("Sanctuary engineering gateway: STOPPED (stale PID cleared)");
    return { stopped: false, alreadyStopped: true, pid };
  }

  signal(pid);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    pause(250);
    const running = inspectProcess(pid, { requireListener: false }).running;
    if (!running && !isHealthy(paths, env)) {
      removeFile(paths.pidPath);
      assertAuthorityUnchanged(paths, authorityBefore);
      console.log(`Sanctuary engineering gateway: STOPPED (pid ${pid})`);
      return { stopped: true, alreadyStopped: false, pid };
    }
  }
  throw new Error(
    "The isolated gateway did not stop cleanly; no broader signal was sent.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    stopEngineeringGateway();
  } catch (error) {
    console.error(`Sanctuary engineering gateway: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
