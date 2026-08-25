import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ENGINEERING_AGENT_IDS,
  ENGINEERING_PROFILE,
  assertDedicatedStateOwnership,
  buildActivationRecord,
  buildEngineeringEnvironment,
  buildGitHubWrapper,
  buildOpenClawWrapper,
  copyProtected,
  ensurePrivateDirectory,
  readProtected,
  resolveEngineeringRuntimePaths,
  writeProtectedAtomic,
} from "./openclaw-engineering-runtime.mjs";

const paths = resolveEngineeringRuntimePaths();

function run(command, args = [], options = {}) {
  const execution = spawnSync(command, args, {
    cwd: options.cwd ?? paths.repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (execution.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
  return execution.stdout?.trim() ?? "";
}

function prepareAgentWorkspaces() {
  for (const role of ["supervisor", "worker", "reviewer"]) {
    const workspace = paths[`${role}Workspace`];
    ensurePrivateDirectory(workspace);
    writeProtectedAtomic(
      join(workspace, "AGENTS.md"),
      readFileSync(join(paths.agentTemplateRoot, role, "AGENTS.md"), "utf8"),
      0o600,
    );
  }
  ensurePrivateDirectory(join(paths.workerWorkspace, "tasks"));
}

function prepareServiceToken() {
  if (existsSync(paths.serviceTokenPath)) {
    readProtected(
      paths.serviceTokenPath,
      "Engineering 1Password service token",
    );
    return;
  }
  copyProtected(
    paths.legacyServiceTokenPath,
    paths.serviceTokenPath,
    "Legacy Sanctuary 1Password service token",
  );
}

function validateAgentRoster(rawPlugins) {
  const plugins = JSON.parse(rawPlugins);
  const codex = plugins.plugins?.find((plugin) => plugin.id === "codex");
  if (!codex || codex.status !== "loaded") {
    throw new Error("The bundled Codex harness is not loaded.");
  }
}

export function activateEngineeringRuntime() {
  if (process.platform !== "darwin") {
    throw new Error("This activation must run on the Mac mini.");
  }
  if (run("/usr/bin/id", ["-un"]) !== "sanctuary-runner") {
    throw new Error("Activation must run as sanctuary-runner.");
  }
  if (!existsSync(paths.openclawBinary) || !existsSync(paths.ghBinary)) {
    throw new Error("OpenClaw or the verified GitHub CLI binary is missing.");
  }

  run(
    process.execPath,
    [join(paths.repoRoot, "scripts/ai/mac-filevault-gate.mjs")],
    {
      inherit: true,
    },
  );

  ensurePrivateDirectory(paths.stateDir);
  assertDedicatedStateOwnership(paths);
  writeProtectedAtomic(
    paths.ownerPath,
    `${JSON.stringify({ schemaVersion: 1, profile: ENGINEERING_PROFILE }, null, 2)}\n`,
  );
  prepareServiceToken();
  if (!existsSync(paths.gatewayTokenPath)) {
    writeProtectedAtomic(
      paths.gatewayTokenPath,
      `${randomBytes(32).toString("base64url")}\n`,
    );
  }
  writeProtectedAtomic(
    paths.configPath,
    readFileSync(paths.configTemplatePath, "utf8"),
  );
  prepareAgentWorkspaces();

  ensurePrivateDirectory(paths.runtimeBinDir);
  writeProtectedAtomic(
    join(paths.runtimeBinDir, "gh"),
    buildGitHubWrapper(paths),
    0o700,
  );
  writeProtectedAtomic(
    paths.openclawWrapperPath,
    buildOpenClawWrapper(paths),
    0o700,
  );

  const env = buildEngineeringEnvironment(
    paths,
    readProtected(paths.gatewayTokenPath, "Engineering gateway token"),
  );
  run(paths.openclawBinary, ["config", "validate"], { env, inherit: true });
  run(
    paths.openclawBinary,
    ["approvals", "set", "--file", paths.approvalsTemplatePath],
    { env, inherit: true },
  );
  validateAgentRoster(
    run(paths.openclawBinary, ["plugins", "list", "--json"], { env }),
  );
  run(
    paths.openclawBinary,
    ["doctor", "--lint", "--only", "codex/managed-app-server", "--json"],
    { env, inherit: true },
  );
  run(
    process.execPath,
    [
      join(paths.repoRoot, "scripts/ai/mac-machine-credential-gate.mjs"),
      "--attest-op-read-only",
    ],
    { env, inherit: true },
  );
  run(
    process.execPath,
    [join(paths.repoRoot, "scripts/ai/github-app-token.mjs"), "--verify"],
    { env, inherit: true },
  );

  writeProtectedAtomic(
    paths.activationPath,
    `${JSON.stringify(buildActivationRecord(paths), null, 2)}\n`,
  );
  console.log("Sanctuary engineering runtime: CONFIGURED");
  console.log(`Named agents: ${ENGINEERING_AGENT_IDS.join(", ")}`);
  console.log(
    "OpenAI sign-in and the isolated role-boundary rehearsal remain.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    activateEngineeringRuntime();
  } catch (error) {
    console.error(`Sanctuary engineering runtime: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
