import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ENGINEERING_PROFILE = "sanctuary-engineering";
export const ENGINEERING_GATEWAY_PORT = 19011;
export const CODEX_PLUGIN_SPEC = "@openclaw/codex@2026.7.1-1";
export const LANE_PLUGIN_ID = "sanctuary-engineering-lanes";
export const LANE_PLUGIN_VERSION = "1.2.16";
export const ENGINEERING_AGENT_IDS = Object.freeze([
  "sanctuary-engineering-supervisor",
  "sanctuary-coding-worker",
  "sanctuary-code-reviewer",
]);

const moduleRepoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function resolveEngineeringRuntimePaths({
  home = homedir(),
  repoRoot = moduleRepoRoot,
} = {}) {
  const stateDir = join(home, `.openclaw-${ENGINEERING_PROFILE}`);
  const credentialsDir = join(stateDir, "credentials");
  const workspaceRoot = join(stateDir, "workspaces");
  return {
    home,
    repoRoot,
    stateDir,
    configPath: join(stateDir, "openclaw.json"),
    ownerPath: join(stateDir, "sanctuary-engineering-owner.json"),
    activationPath: join(stateDir, "sanctuary-engineering-activation.json"),
    approvalsPath: join(stateDir, "exec-approvals.json"),
    gatewayTokenPath: join(credentialsDir, "gateway-token"),
    serviceTokenPath: join(
      credentialsDir,
      "onepassword",
      "service-account-token",
    ),
    legacyServiceTokenPath: join(
      home,
      ".openclaw",
      "credentials",
      "onepassword",
      "service-account-token",
    ),
    defaultConfigPath: join(home, ".openclaw", "openclaw.json"),
    defaultApprovalsPath: join(home, ".openclaw", "exec-approvals.json"),
    configTemplatePath: join(
      repoRoot,
      "infra",
      "openclaw",
      "engineering",
      "openclaw.json",
    ),
    approvalsTemplatePath: join(
      repoRoot,
      "infra",
      "openclaw",
      "engineering",
      "exec-approvals.json",
    ),
    agentTemplateRoot: join(
      repoRoot,
      "infra",
      "openclaw",
      "engineering",
      "agents",
    ),
    lanePluginSource: join(
      repoRoot,
      "infra",
      "openclaw",
      "engineering",
      "plugins",
      LANE_PLUGIN_ID,
    ),
    workspaceRoot,
    supervisorWorkspace: join(workspaceRoot, "supervisor"),
    workerWorkspace: join(workspaceRoot, "worker"),
    reviewerWorkspace: join(workspaceRoot, "reviewer"),
    runtimeBinDir: join(stateDir, "bin"),
    openclawWrapperPath: join(home, "bin", "sanctuary-openclaw"),
    engineeringLaneWrapperPath: join(home, "bin", "sanctuary-engineering-lane"),
    openclawBinary: join(home, ".local", "bin", "openclaw"),
    ghBinary: join(home, ".local", "lib", "github-cli", "bin", "gh"),
    pidPath: join(stateDir, "run", "gateway-caffeinate.pid"),
    logPath: join(stateDir, "logs", "gateway.log"),
  };
}

export function ensurePrivateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

export function writeProtectedAtomic(path, content, mode = 0o600) {
  ensurePrivateDirectory(dirname(path));
  const temporaryPath = `${path}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
  writeFileSync(temporaryPath, content, { encoding: "utf8", mode });
  chmodSync(temporaryPath, mode);
  renameSync(temporaryPath, path);
  chmodSync(path, mode);
}

export function readProtected(path, label) {
  const stats = statSync(path);
  if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
    throw new Error(`${label} is missing or readable outside its owner.`);
  }
  const value = readFileSync(path, "utf8").trim();
  if (!value) throw new Error(`${label} is empty.`);
  return value;
}

export function copyProtected(source, destination, label) {
  writeProtectedAtomic(destination, `${readProtected(source, label)}\n`);
}

function hashFile(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

export function fingerprintDefaultAuthority(paths) {
  return Object.fromEntries(
    [paths.defaultConfigPath, paths.defaultApprovalsPath].map((path) => [
      path,
      existsSync(path) ? hashFile(path) : null,
    ]),
  );
}

export function assertDefaultAuthorityUnchanged(paths, expected) {
  const actual = fingerprintDefaultAuthority(paths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      "The default OpenClaw authority files changed during an isolated command.",
    );
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

export function buildOpenClawWrapper(paths) {
  return `#!/bin/zsh
export OPENCLAW_CONFIG_PATH=${shellQuote(paths.configPath)}
export OPENCLAW_STATE_DIR=${shellQuote(paths.stateDir)}
export OPENCLAW_GATEWAY_TOKEN="$(/bin/cat ${shellQuote(paths.gatewayTokenPath)})"
export OPENCLAW_ALLOW_MULTI_GATEWAY=1
export SANCTUARY_ENGINEERING_REPO_ROOT=${shellQuote(paths.repoRoot)}
export SANCTUARY_ENGINEERING_GIT_BINARY=/usr/bin/git
export SANCTUARY_ENGINEERING_GH_BINARY=${shellQuote(paths.ghBinary)}
export PATH=${shellQuote(paths.runtimeBinDir)}:${shellQuote(join(paths.home, ".local", "bin"))}:$PATH
exec ${shellQuote(paths.openclawBinary)} "$@"
`;
}

export function buildEngineeringLaneWrapper(
  paths,
  nodeBinary = process.execPath,
) {
  const laneCli = join(paths.repoRoot, "scripts", "ai", "engineering-lane.mjs");
  return `#!/bin/zsh
export OPENCLAW_STATE_DIR=${shellQuote(paths.stateDir)}
export SANCTUARY_ENGINEERING_REPO_ROOT=${shellQuote(paths.repoRoot)}
export SANCTUARY_ENGINEERING_GIT_BINARY=/usr/bin/git
export SANCTUARY_ENGINEERING_GH_BINARY=${shellQuote(paths.ghBinary)}
export GH_PROMPT_DISABLED=1
export GIT_TERMINAL_PROMPT=0
export PATH=${shellQuote(paths.runtimeBinDir)}:${shellQuote(join(paths.home, "bin"))}:${shellQuote(join(paths.home, ".local", "bin"))}:$PATH
exec ${shellQuote(nodeBinary)} ${shellQuote(laneCli)} "$@"
`;
}

export function buildGitHubWrapper(paths, nodeBinary = process.execPath) {
  const helper = join(paths.repoRoot, "scripts", "ai", "github-app-token.mjs");
  return `#!/bin/zsh
export OPENCLAW_CONFIG_PATH=${shellQuote(paths.configPath)}
export OPENCLAW_STATE_DIR=${shellQuote(paths.stateDir)}
export OPENCLAW_GATEWAY_TOKEN="$(/bin/cat ${shellQuote(paths.gatewayTokenPath)})"
export GH_PROMPT_DISABLED=1
export GIT_TERMINAL_PROMPT=0
export SANCTUARY_ENGINEERING_GH_BINARY=${shellQuote(paths.ghBinary)}
exec ${shellQuote(nodeBinary)} ${shellQuote(helper)} --safe-gh "$@"
`;
}

export function buildEngineeringEnvironment(
  paths,
  gatewayToken,
  baseEnvironment = process.env,
) {
  return {
    ...baseEnvironment,
    OPENCLAW_CONFIG_PATH: paths.configPath,
    OPENCLAW_STATE_DIR: paths.stateDir,
    OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    OPENCLAW_ALLOW_MULTI_GATEWAY: "1",
    SANCTUARY_ENGINEERING_REPO_ROOT: paths.repoRoot,
    SANCTUARY_ENGINEERING_GIT_BINARY: "/usr/bin/git",
    SANCTUARY_ENGINEERING_GH_BINARY: paths.ghBinary,
    PATH: `${paths.runtimeBinDir}:${join(paths.home, ".local", "bin")}:${baseEnvironment.PATH ?? ""}`,
  };
}

export function assertDedicatedStateOwnership(paths) {
  if (!existsSync(paths.configPath)) return;
  if (existsSync(paths.ownerPath)) {
    const owner = JSON.parse(readFileSync(paths.ownerPath, "utf8"));
    if (owner.profile === ENGINEERING_PROFILE) return;
    throw new Error(
      "The engineering state directory belongs to another runtime.",
    );
  }

  const existing = readFileSync(paths.configPath, "utf8");
  const canonical = readFileSync(paths.configTemplatePath, "utf8");
  if (existing !== canonical) {
    throw new Error(
      "Refusing to overwrite an unclaimed engineering state directory.",
    );
  }
}

export function buildActivationRecord(paths, activatedAt = new Date()) {
  const agentInstructionHashes = Object.fromEntries(
    ["supervisor", "worker", "reviewer"].map((role) => [
      role,
      hashFile(join(paths.agentTemplateRoot, role, "AGENTS.md")),
    ]),
  );
  return {
    schemaVersion: 1,
    state: "engineering-runtime-configured",
    profile: ENGINEERING_PROFILE,
    activatedAt: activatedAt.toISOString(),
    gatewayPort: ENGINEERING_GATEWAY_PORT,
    stateDirectory: paths.stateDir,
    configHash: hashFile(paths.configTemplatePath),
    agentInstructionHashes,
    agents: ENGINEERING_AGENT_IDS,
    maxWorkers: 1,
    approvalMode: "worker-full-no-prompts",
    recoveryMode: "rebuild-from-git-and-reissue-credentials",
    sharedDefaultStateTouched: false,
    allowedEffects: [
      "provision-manifest-bound-worktree",
      "edit-assigned-worktree",
      "run-focused-checks",
      "push-feature-branch",
      "open-or-update-draft-pr",
    ],
    prohibitedEffects: [
      "force-push",
      "push-main",
      "merge-pr",
      "deploy",
      "production-data",
      "customer-contact",
    ],
  };
}
