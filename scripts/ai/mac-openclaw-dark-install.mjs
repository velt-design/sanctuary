#!/usr/bin/env node

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const release = JSON.parse(
  readFileSync(join(repoRoot, "infra/openclaw/dark/openclaw-release.json"), "utf8"),
);

function run(command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    stdio: options.inherit ? "inherit" : "pipe",
  });
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

function readKeychainSecret(service) {
  const lookup = run("/usr/bin/security", [
    "find-generic-password",
    "-a",
    "sanctuary-runner",
    "-s",
    service,
    "-w",
    "/Library/Keychains/System.keychain",
  ]);
  return lookup.status === 0 ? lookup.stdout.trim() : null;
}

function runPrerequisiteGate(script, args = []) {
  return run(process.execPath, [join(repoRoot, "scripts/ai", script), ...args], {
    inherit: true,
  }).status === 0;
}

function checkPrerequisites() {
  if (process.platform !== "darwin") {
    throw new Error("This installer must run on the Mac mini.");
  }

  const runtimeUser = run("/usr/bin/id", ["-un"]).stdout.trim();
  const source = readOption("--backup-source");
  const restored = readOption("--backup-restored");
  const opAttested = process.argv.includes("--attest-op-read-only");

  const checks = {
    runtimeUser: runtimeUser === "sanctuary-runner",
    fileVault: runPrerequisiteGate("mac-filevault-gate.mjs"),
    backupRestore:
      Boolean(source && restored) &&
      runPrerequisiteGate("mac-backup-restore-gate.mjs", [
        "--source",
        source,
        "--restored",
        restored,
      ]),
    machineCredentials:
      opAttested &&
      runPrerequisiteGate("mac-machine-credential-gate.mjs", ["--attest-op-read-only"]),
  };

  const gatewayToken = readKeychainSecret("sanctuary.openclaw.gateway-token");
  checks.gatewayToken = Boolean(gatewayToken && gatewayToken.length >= 32);

  const podman = run("podman", ["info", "--format", "{{.Host.Security.Rootless}}"]).stdout
    .trim()
    .toLowerCase();
  checks.rootlessPodman = podman === "true";

  console.log("OpenClaw dark-install prerequisites:");
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`- ${name}: ${passed ? "PASS" : "FAIL"}`);
  }

  return {
    passed: Object.values(checks).every(Boolean),
    gatewayToken,
  };
}

function verifyRegistryRelease() {
  const lookup = run("npm", [
    "view",
    `${release.package}@${release.version}`,
    "version",
    "dist.integrity",
    "--json",
  ]);
  if (lookup.status !== 0) return false;
  try {
    const observed = JSON.parse(lookup.stdout);
    return observed.version === release.version && observed["dist.integrity"] === release.integrity;
  } catch {
    return false;
  }
}

function openClawEnvironment(configPath, stateDir, prefix, gatewayToken) {
  return {
    ...process.env,
    DO_NOT_TRACK: "1",
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    OPENCLAW_NO_AUTO_UPDATE: "1",
    OPENCLAW_STATE_DIR: stateDir,
    PATH: `${join(prefix, "bin")}:${process.env.PATH ?? ""}`,
  };
}

function requireCleanAudit(openclaw, environment) {
  const audit = run(openclaw, ["security", "audit", "--json"], { env: environment });
  if (audit.status !== 0) return false;
  try {
    const report = JSON.parse(audit.stdout);
    return report.summary?.critical === 0 && report.summary?.warn === 0;
  } catch {
    return false;
  }
}

function requireDeniedExec(openclaw, environment) {
  const policy = run(openclaw, ["exec-policy", "show", "--json"], {
    env: environment,
  });
  if (policy.status !== 0) return false;
  try {
    const report = JSON.parse(policy.stdout);
    return report.effectivePolicy?.scopes?.every(
      (scope) =>
        scope.mode?.effective === "deny" &&
        scope.security?.effective === "deny" &&
        scope.askFallback?.effective === "deny",
    );
  } catch {
    return false;
  }
}

function installDarkOpenClaw(gatewayToken) {
  const home = homedir();
  const prefix = join(home, ".local");
  const stateDir = join(home, ".openclaw");
  const configPath = join(stateDir, "openclaw.json");
  const approvalsPath = join(stateDir, "exec-approvals.json");
  const openclaw = join(prefix, "bin", "openclaw");

  if (existsSync(openclaw) || existsSync(configPath) || existsSync(approvalsPath)) {
    throw new Error("An OpenClaw install or state file already exists; review it before proceeding.");
  }
  if (!verifyRegistryRelease()) {
    throw new Error("The npm package version or registry integrity does not match the pin.");
  }

  const installation = run("npm", [
    "install",
    "--global",
    "--prefix",
    prefix,
    `${release.package}@${release.version}`,
  ]);
  if (installation.status !== 0 || !existsSync(openclaw)) {
    throw new Error("Pinned OpenClaw package installation failed.");
  }

  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  copyFileSync(join(repoRoot, "infra/openclaw/dark/openclaw.json"), configPath);
  copyFileSync(join(repoRoot, "infra/openclaw/dark/exec-approvals.json"), approvalsPath);
  chmodSync(configPath, 0o600);
  chmodSync(approvalsPath, 0o600);

  const imageBuild = run(
    "podman",
    [
      "build",
      "--pull=always",
      "-t",
      "localhost/openclaw-sandbox:bookworm-slim-sanctuary",
      "-f",
      join(repoRoot, "infra/openclaw/dark/Dockerfile"),
      join(repoRoot, "infra/openclaw/dark"),
    ],
    { inherit: true },
  );
  if (imageBuild.status !== 0) throw new Error("OpenClaw sandbox image build failed.");

  const environment = openClawEnvironment(configPath, stateDir, prefix, gatewayToken);
  const version = run(openclaw, ["--version"], { env: environment });
  const config = run(openclaw, ["config", "validate"], { env: environment });
  if (
    version.status !== 0 ||
    !version.stdout.includes(release.version) ||
    config.status !== 0 ||
    !requireCleanAudit(openclaw, environment) ||
    !requireDeniedExec(openclaw, environment)
  ) {
    throw new Error("OpenClaw installed, but one or more dark-state checks failed.");
  }

  console.log("OpenClaw dark installation: PASS");
  console.log("The Gateway was not started and no daemon was installed.");
}

function main() {
  const prerequisites = checkPrerequisites();
  if (!prerequisites.passed) {
    console.error("OpenClaw dark installation: BLOCKED by failed prerequisites.");
    process.exitCode = 1;
    return;
  }
  if (!process.argv.includes("--install")) {
    console.log("OpenClaw dark installation: READY. Re-run with --install after review.");
    return;
  }
  installDarkOpenClaw(prerequisites.gatewayToken);
}

try {
  main();
} catch (error) {
  console.error(`OpenClaw dark installation: ERROR — ${error.message}`);
  process.exitCode = 2;
}
