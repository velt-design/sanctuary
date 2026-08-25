import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const release = JSON.parse(
  readFileSync(
    join(repoRoot, "infra/openclaw/dark/openclaw-release.json"),
    "utf8",
  ),
);
export function buildDarkPreparationRecord({ preparedAt = new Date() } = {}) {
  return {
    schemaVersion: 1,
    state: "prepared-dark",
    packageVersion: release.version,
    preparedAt: preparedAt.toISOString(),
    activationAllowed: false,
    recoveryMode: "rebuild-from-git",
    prohibitions: [
      "gateway-start",
      "launch-agent",
      "model-provider",
      "channel",
      "writable-workspace",
      "staging-access",
      "production-access",
      "customer-data",
    ],
  };
}

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
  if (!value || value.startsWith("--"))
    throw new Error(`${name} requires a value.`);
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
  return (
    run(process.execPath, [join(repoRoot, "scripts/ai", script), ...args], {
      inherit: true,
    }).status === 0
  );
}

function rootlessPodmanReady() {
  return (
    run("podman", ["info", "--format", "{{.Host.Security.Rootless}}"])
      .stdout.trim()
      .toLowerCase() === "true"
  );
}

function checkPreparationPrerequisites() {
  if (process.platform !== "darwin") {
    throw new Error("This installer must run on the Mac mini.");
  }

  const checks = {
    runtimeUser:
      run("/usr/bin/id", ["-un"]).stdout.trim() === "sanctuary-runner",
    rootlessPodman: rootlessPodmanReady(),
  };

  console.log("OpenClaw credential-free dark-preparation prerequisites:");
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`- ${name}: ${passed ? "PASS" : "FAIL"}`);
  }
  console.log("- recoveryMode: PASS — rebuild from GitHub and reissue secrets");
  console.log("- activation: DENIED");

  return Object.values(checks).every(Boolean);
}

function checkPrerequisites() {
  if (process.platform !== "darwin") {
    throw new Error("This installer must run on the Mac mini.");
  }

  const runtimeUser = run("/usr/bin/id", ["-un"]).stdout.trim();
  const opAttested = process.argv.includes("--attest-op-read-only");

  const checks = {
    runtimeUser: runtimeUser === "sanctuary-runner",
    fileVault: runPrerequisiteGate("mac-filevault-gate.mjs"),
    machineCredentials:
      opAttested &&
      runPrerequisiteGate("mac-machine-credential-gate.mjs", [
        "--attest-op-read-only",
      ]),
  };

  const gatewayToken = readKeychainSecret("sanctuary.openclaw.gateway-token");
  checks.gatewayToken = Boolean(gatewayToken && gatewayToken.length >= 32);

  checks.rootlessPodman = rootlessPodmanReady();

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
    return (
      observed.version === release.version &&
      observed["dist.integrity"] === release.integrity
    );
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
  const audit = run(openclaw, ["security", "audit", "--json"], {
    env: environment,
  });
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

function darkPaths() {
  const home = homedir();
  const prefix = join(home, ".local");
  const stateDir = join(home, ".openclaw");
  return {
    prefix,
    stateDir,
    configPath: join(stateDir, "openclaw.json"),
    approvalsPath: join(stateDir, "exec-approvals.json"),
    preparationPath: join(stateDir, "sanctuary-dark-preparation.json"),
    openclaw: join(prefix, "bin", "openclaw"),
  };
}

function darkRuntimeStopped() {
  const processCheck = run("/usr/bin/pgrep", ["-x", "openclaw"]);
  const listenerCheck = run("/usr/sbin/lsof", [
    "-nP",
    "-iTCP:18789",
    "-sTCP:LISTEN",
  ]);
  const launchAgents = run("/bin/launchctl", ["list"]);
  return (
    processCheck.status !== 0 &&
    listenerCheck.status !== 0 &&
    !/openclaw/i.test(launchAgents.stdout)
  );
}

function verifyDarkOpenClaw(gatewayToken) {
  const { prefix, stateDir, configPath, approvalsPath, openclaw } = darkPaths();
  if (
    !existsSync(openclaw) ||
    !existsSync(configPath) ||
    !existsSync(approvalsPath)
  ) {
    return false;
  }
  if (
    readFileSync(configPath, "utf8") !==
      readFileSync(
        join(repoRoot, "infra/openclaw/dark/openclaw.json"),
        "utf8",
      ) ||
    readFileSync(approvalsPath, "utf8") !==
      readFileSync(
        join(repoRoot, "infra/openclaw/dark/exec-approvals.json"),
        "utf8",
      )
  ) {
    return false;
  }
  if (
    run("podman", [
      "image",
      "exists",
      "localhost/openclaw-sandbox:bookworm-slim-sanctuary",
    ]).status !== 0
  ) {
    return false;
  }

  const environment = openClawEnvironment(
    configPath,
    stateDir,
    prefix,
    gatewayToken,
  );
  const version = run(openclaw, ["--version"], { env: environment });
  const config = run(openclaw, ["config", "validate"], { env: environment });
  return (
    version.status === 0 &&
    version.stdout.includes(release.version) &&
    config.status === 0 &&
    requireCleanAudit(openclaw, environment) &&
    requireDeniedExec(openclaw, environment) &&
    darkRuntimeStopped()
  );
}

function writePreparationRecord(record) {
  const { stateDir, preparationPath } = darkPaths();
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileSync(preparationPath, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(preparationPath, 0o600);
}

function installDarkOpenClaw(gatewayToken, preparationRecord) {
  const {
    prefix,
    stateDir,
    configPath,
    approvalsPath,
    preparationPath,
    openclaw,
  } = darkPaths();

  if (
    existsSync(openclaw) ||
    existsSync(configPath) ||
    existsSync(approvalsPath) ||
    existsSync(preparationPath)
  ) {
    throw new Error(
      "An OpenClaw install or state file already exists; review it before proceeding.",
    );
  }
  if (!verifyRegistryRelease()) {
    throw new Error(
      "The npm package version or registry integrity does not match the pin.",
    );
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
  copyFileSync(
    join(repoRoot, "infra/openclaw/dark/exec-approvals.json"),
    approvalsPath,
  );
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
  if (imageBuild.status !== 0)
    throw new Error("OpenClaw sandbox image build failed.");

  writePreparationRecord(preparationRecord);
  if (!verifyDarkOpenClaw(gatewayToken)) {
    throw new Error(
      "OpenClaw installed, but one or more dark-state checks failed.",
    );
  }

  console.log("OpenClaw dark installation: PASS");
  console.log("The Gateway was not started and no daemon was installed.");
}

function main() {
  if (process.argv.includes("--prepare-dark")) {
    if (process.argv.includes("--install")) {
      throw new Error("Use --prepare-dark or --install, not both.");
    }
    if (!checkPreparationPrerequisites()) {
      console.error(
        "OpenClaw dark preparation: BLOCKED by failed prerequisites.",
      );
      process.exitCode = 1;
      return;
    }

    const validationToken = randomBytes(32).toString("base64url");
    installDarkOpenClaw(
      validationToken,
      buildDarkPreparationRecord(),
    );
    console.log("Recovery mode is rebuild-from-Git; no local backup is required.");
    console.log("Activation remains blocked by the full prerequisite gate.");
    return;
  }

  const prerequisites = checkPrerequisites();
  if (!prerequisites.passed) {
    console.error(
      "OpenClaw dark installation: BLOCKED by failed prerequisites.",
    );
    process.exitCode = 1;
    return;
  }
  if (!process.argv.includes("--install")) {
    console.log(
      "OpenClaw dark installation: READY. Re-run with --install after review.",
    );
    return;
  }
  if (existsSync(darkPaths().openclaw)) {
    if (!verifyDarkOpenClaw(prerequisites.gatewayToken)) {
      throw new Error(
        "The existing dark preparation no longer matches the reviewed state.",
      );
    }
    writePreparationRecord(buildDarkPreparationRecord());
    console.log("OpenClaw dark installation: PASS");
    console.log(
      "The existing preparation was revalidated; activation was not performed.",
    );
    return;
  }
  installDarkOpenClaw(prerequisites.gatewayToken, buildDarkPreparationRecord());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`OpenClaw dark installation: ERROR — ${error.message}`);
    process.exitCode = 2;
  }
}
