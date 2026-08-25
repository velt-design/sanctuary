import { randomBytes } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const home = homedir();
const stateDir = join(home, ".openclaw");
const configPath = join(stateDir, "openclaw.json");
const gatewayTokenPath = join(stateDir, "credentials", "gateway-token");
const openclawBinary = join(home, ".local", "bin", "openclaw");
const ghBinary = join(home, ".local", "lib", "github-cli", "bin", "gh");
const binDir = join(home, "bin");

function run(command, args = [], options = {}) {
  const execution = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (execution.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
  return execution.stdout?.trim() ?? "";
}

function writeProtected(path, content, mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, content, { encoding: "utf8", mode });
  chmodSync(path, mode);
}

function writeWrapper(path, content) {
  writeProtected(path, content, 0o700);
}

function activationEnvironment() {
  return {
    ...process.env,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_TOKEN: readFileSync(gatewayTokenPath, "utf8").trim(),
    OPENCLAW_STATE_DIR: stateDir,
    PATH: `${binDir}:${join(home, ".local", "bin")}:${process.env.PATH ?? ""}`,
  };
}

function main() {
  if (process.platform !== "darwin") {
    throw new Error("This activation must run on the Mac mini.");
  }
  if (run("/usr/bin/id", ["-un"]) !== "sanctuary-runner") {
    throw new Error("Activation must run as sanctuary-runner.");
  }
  if (!existsSync(openclawBinary) || !existsSync(ghBinary)) {
    throw new Error("OpenClaw or the verified GitHub CLI binary is missing.");
  }

  run(process.execPath, [join(repoRoot, "scripts/ai/mac-filevault-gate.mjs")], {
    inherit: true,
  });
  run(
    process.execPath,
    [join(repoRoot, "scripts/ai/mac-machine-credential-gate.mjs"), "--attest-op-read-only"],
    { inherit: true },
  );

  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  if (existsSync(configPath) && !existsSync(join(stateDir, "openclaw.dark.json"))) {
    copyFileSync(configPath, join(stateDir, "openclaw.dark.json"));
    chmodSync(join(stateDir, "openclaw.dark.json"), 0o600);
  }
  if (!existsSync(gatewayTokenPath)) {
    writeProtected(gatewayTokenPath, randomBytes(32).toString("base64url"));
  }
  copyFileSync(
    join(repoRoot, "infra/openclaw/development/openclaw.json"),
    configPath,
  );
  chmodSync(configPath, 0o600);
  copyFileSync(
    join(repoRoot, "infra/openclaw/development/exec-approvals.json"),
    join(stateDir, "exec-approvals.json"),
  );
  chmodSync(join(stateDir, "exec-approvals.json"), 0o600);

  mkdirSync(binDir, { recursive: true, mode: 0o700 });
  writeWrapper(
    join(binDir, "openclaw"),
    `#!/bin/zsh\nexport OPENCLAW_CONFIG_PATH=${configPath}\nexport OPENCLAW_STATE_DIR=${stateDir}\nexport OPENCLAW_GATEWAY_TOKEN="$(/bin/cat ${gatewayTokenPath})"\nexec ${openclawBinary} "$@"\n`,
  );
  writeWrapper(
    join(binDir, "gh"),
    `#!/bin/zsh\nTOKEN="$(/usr/local/bin/node ${join(repoRoot, "scripts/ai/github-app-token.mjs")} --raw)" || exit 1\nexport GH_TOKEN="$TOKEN"\nexec ${ghBinary} "$@"\n`,
  );

  const credentialHelper = `!node ${join(repoRoot, "scripts/ai/github-app-token.mjs")} --git-credential`;
  run("/usr/bin/git", [
    "config",
    "--global",
    "credential.https://github.com.helper",
    credentialHelper,
  ]);
  run("/usr/bin/git", ["config", "--global", "user.name", "Sanctuary Node PR Bot"]);
  run("/usr/bin/git", [
    "config",
    "--global",
    "user.email",
    "sanctuary-node-pr-bot@users.noreply.github.com",
  ]);

  const env = activationEnvironment();
  const installedPlugins = JSON.parse(
    run(openclawBinary, ["plugins", "list", "--json"], { env }),
  );
  if (!installedPlugins.plugins?.some((plugin) => plugin.id === "codex")) {
    run(openclawBinary, ["plugins", "install", "@openclaw/codex"], {
      env,
      inherit: true,
    });
  }
  run(openclawBinary, ["config", "validate"], { env, inherit: true });
  run(process.execPath, [join(repoRoot, "scripts/ai/github-app-token.mjs"), "--verify"], {
    env,
    inherit: true,
  });
  const plugins = JSON.parse(
    run(openclawBinary, ["plugins", "list", "--json"], { env }),
  );
  const codex = plugins.plugins?.find((plugin) => plugin.id === "codex");
  if (!codex || codex.status !== "loaded") {
    throw new Error("The bundled Codex harness is not loaded.");
  }

  writeProtected(
    join(stateDir, "sanctuary-development-activation.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        state: "development-ready",
        activatedAt: new Date().toISOString(),
        recoveryMode: "rebuild-from-git",
        approvalMode: "full-no-prompts",
        workspace: "/Users/sanctuary-runner/workspaces/sanctuary",
        githubRepository: "velt-design/sanctuary",
        allowedEffects: ["edit-code", "run-tests", "push-branch", "open-draft-pr"],
        prohibitedEffects: ["merge-pr", "deploy", "production-data", "customer-contact"],
      },
      null,
      2,
    )}\n`,
  );
  console.log("OpenClaw development activation: READY");
  console.log("Model sign-in, headless start, and one end-to-end coding task remain.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`OpenClaw development activation: ERROR — ${error.message}`);
    process.exitCode = 1;
  }
}
