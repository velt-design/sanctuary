import { readFileSync, statSync } from "node:fs";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createGitHubAppJwt,
  readGitHubVaultFields,
  resolveMachineServiceTokenPath,
} from "./mac-machine-credential-gate.mjs";

const VAULT = "Sanctuary - Node Runtime";
const ITEM = "GitHub - Sanctuary Node PR Bot";
const REPOSITORY = "velt-design/sanctuary";
const REPOSITORY_PATHS = new Set([
  "velt-design/sanctuary",
  "velt-design/sanctuary.git",
]);

function run(command, args, env = process.env) {
  const execution = spawnSync(command, args, { encoding: "utf8", env });
  if (execution.status !== 0) {
    throw new Error(`${command} failed without returning a usable credential.`);
  }
  return execution.stdout.trim();
}

function readServiceToken() {
  const tokenPath = resolveMachineServiceTokenPath();
  const stats = statSync(tokenPath);
  if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
    throw new Error(
      "The 1Password service-account token file is not protected.",
    );
  }
  const token = readFileSync(tokenPath, "utf8").trim();
  if (!token) throw new Error("The 1Password service-account token is empty.");
  return token;
}

function readGitHubIdentity() {
  const serviceToken = readServiceToken();
  const item = JSON.parse(
    run("op", ["item", "get", ITEM, "--vault", VAULT, "--format", "json"], {
      ...process.env,
      OP_SERVICE_ACCOUNT_TOKEN: serviceToken,
    }),
  );
  const identity = readGitHubVaultFields(item.fields);
  if (!identity.appId || !identity.installationId || !identity.privateKey) {
    throw new Error("The GitHub App item is incomplete.");
  }
  return identity;
}

async function requestInstallationToken(fetchImpl = fetch) {
  const identity = readGitHubIdentity();
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${identity.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${createGitHubAppJwt(identity.appId, identity.privateKey)}`,
        "Content-Type": "application/json",
        "User-Agent": "sanctuary-node-pr-bot",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        repositories: ["sanctuary"],
        permissions: {
          actions: "write",
          contents: "write",
          pull_requests: "write",
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub installation-token request failed (${response.status}).`,
    );
  }
  const payload = await response.json();
  const repositories =
    payload.repositories?.map((repo) => repo.full_name) ?? [];
  if (
    !payload.token ||
    repositories.length !== 1 ||
    repositories[0] !== REPOSITORY ||
    payload.permissions?.actions !== "write" ||
    payload.permissions?.contents !== "write" ||
    payload.permissions?.pull_requests !== "write"
  ) {
    throw new Error(
      "GitHub returned a token outside the expected repository contract.",
    );
  }
  return {
    token: payload.token,
    expiresAt: payload.expires_at,
    repository: repositories[0],
    permissions: payload.permissions,
  };
}

function readCredentialRequest() {
  return Object.fromEntries(
    readFileSync(0, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const split = line.indexOf("=");
        return [line.slice(0, split), line.slice(split + 1)];
      }),
  );
}

function readFlag(args, name) {
  const indexes = args
    .map((value, index) => (value === name ? index : -1))
    .filter((index) => index !== -1);
  if (
    indexes.length !== 1 ||
    !args[indexes[0] + 1] ||
    args[indexes[0] + 1].startsWith("--")
  ) {
    throw new Error(`GitHub command requires ${name}.`);
  }
  return args[indexes[0] + 1];
}

function assertOnlyFlags(args, allowedFlags) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) continue;
    if (!allowedFlags.has(value)) {
      throw new Error(`GitHub command flag ${value} is not allowed.`);
    }
    index += 1;
  }
}

function assertSafeBranch(value, label) {
  if (
    !/^[a-z0-9][a-zA-Z0-9._/-]{1,199}$/.test(value) ||
    value.startsWith("-") ||
    value.endsWith(".lock") ||
    value.includes("..") ||
    value.includes("@{")
  ) {
    throw new Error(`${label} is not a safe branch name.`);
  }
}

export function assertSafeGitHubCommand(args) {
  const [area, action] = args;
  if (area === "version" && args.length === 1) return;
  if (area === "repo" && action === "view") {
    assertOnlyFlags(
      args.slice(2),
      new Set(["--repo", "--json", "--jq", "--template"]),
    );
    if (args.includes("--repo") && readFlag(args, "--repo") !== REPOSITORY) {
      throw new Error(
        "GitHub reads are restricted to the Sanctuary repository.",
      );
    }
    return;
  }
  if (area === "pr" && ["list", "view", "checks", "diff"].includes(action)) {
    assertOnlyFlags(
      args.slice(2),
      new Set([
        "--repo",
        "--head",
        "--base",
        "--state",
        "--json",
        "--jq",
        "--template",
        "--limit",
        "--search",
        "--watch",
        "--interval",
        "--required",
        "--color",
        "--name-only",
        "--patch",
        "--web",
      ]),
    );
    if (readFlag(args, "--repo") !== REPOSITORY) {
      throw new Error(
        "GitHub reads are restricted to the Sanctuary repository.",
      );
    }
    return;
  }
  if (area === "run" && ["list", "view"].includes(action)) {
    assertOnlyFlags(
      args.slice(2),
      new Set([
        "--repo",
        "--branch",
        "--commit",
        "--event",
        "--json",
        "--jq",
        "--limit",
        "--status",
        "--workflow",
        "--job",
        "--log",
        "--log-failed",
        "--verbose",
        "--web",
      ]),
    );
    if (readFlag(args, "--repo") !== REPOSITORY) {
      throw new Error(
        "GitHub reads are restricted to the Sanctuary repository.",
      );
    }
    return;
  }
  if (area === "run" && action === "rerun") {
    if (
      args.length !== 6 ||
      !/^[1-9][0-9]*$/.test(args[2]) ||
      args[3] !== "--failed" ||
      args[4] !== "--repo" ||
      args[5] !== REPOSITORY
    ) {
      throw new Error(
        "Only an exact failed-job workflow rerun is allowed for Sanctuary.",
      );
    }
    return;
  }
  if (area === "pr" && action === "create") {
    const allowed = new Set([
      "--repo",
      "--draft",
      "--base",
      "--head",
      "--title",
      "--body",
    ]);
    for (let index = 2; index < args.length; index += 1) {
      const value = args[index];
      if (value === "--draft") continue;
      if (!value.startsWith("--") || !allowed.has(value) || !args[index + 1]) {
        throw new Error("Only an explicit draft pull request may be created.");
      }
      index += 1;
    }
    if (args.filter((value) => value === "--draft").length !== 1) {
      throw new Error("Pull request creation requires --draft.");
    }
    if (readFlag(args, "--repo") !== REPOSITORY) {
      throw new Error("Draft pull requests are restricted to Sanctuary.");
    }
    const head = readFlag(args, "--head");
    const base = readFlag(args, "--base");
    assertSafeBranch(head, "Draft head");
    assertSafeBranch(base, "Draft base");
    if (["main", "master"].includes(head)) {
      throw new Error(
        "A draft pull request head cannot be a protected branch.",
      );
    }
    readFlag(args, "--title");
    readFlag(args, "--body");
    return;
  }
  throw new Error(
    "The GitHub command is outside the engineering read/draft policy.",
  );
}

async function runSafeGitHub(args) {
  assertSafeGitHubCommand(args);
  const result = await requestInstallationToken();
  const ghBinary =
    process.env.SANCTUARY_ENGINEERING_GH_BINARY ??
    "/Users/sanctuary-runner/.local/lib/github-cli/bin/gh";
  const execution = spawnSync(ghBinary, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      GH_TOKEN: result.token,
      GH_PROMPT_DISABLED: "1",
    },
  });
  if (execution.status !== 0) {
    if (execution.stderr) process.stderr.write(execution.stderr);
    throw new Error("The restricted GitHub command failed.");
  }
  if (execution.stdout) process.stdout.write(execution.stdout);
}

async function main() {
  if (process.argv.includes("--git-credential")) {
    if (process.argv.at(-1) !== "get") return;
    const request = readCredentialRequest();
    if (
      request.protocol !== "https" ||
      request.host !== "github.com" ||
      !REPOSITORY_PATHS.has(request.path)
    ) {
      return;
    }
    const result = await requestInstallationToken();
    process.stdout.write(`username=x-access-token\npassword=${result.token}\n`);
    return;
  }

  const safeGhIndex = process.argv.indexOf("--safe-gh");
  if (safeGhIndex !== -1) {
    await runSafeGitHub(process.argv.slice(safeGhIndex + 1));
    return;
  }

  const result = await requestInstallationToken();
  if (process.argv.includes("--verify")) {
    console.log(
      JSON.stringify({
        repository: result.repository,
        permissions: result.permissions,
        expiresAt: result.expiresAt,
      }),
    );
    return;
  }
  throw new Error("Use --verify, --safe-gh, or --git-credential.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`GitHub App token helper: ERROR — ${error.message}`);
    process.exitCode = 1;
  });
}
