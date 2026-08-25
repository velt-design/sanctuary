import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createGitHubAppJwt,
  readGitHubVaultFields,
} from "./mac-machine-credential-gate.mjs";

const VAULT = "Sanctuary - Node Runtime";
const ITEM = "GitHub - Sanctuary Node PR Bot";
const REPOSITORY = "velt-design/sanctuary";
const TOKEN_PATH = join(
  homedir(),
  ".openclaw",
  "credentials",
  "onepassword",
  "service-account-token",
);

function run(command, args, env = process.env) {
  const execution = spawnSync(command, args, { encoding: "utf8", env });
  if (execution.status !== 0) {
    throw new Error(`${command} failed without returning a usable credential.`);
  }
  return execution.stdout.trim();
}

function readServiceToken() {
  const stats = statSync(TOKEN_PATH);
  if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
    throw new Error("The 1Password service-account token file is not protected.");
  }
  const token = readFileSync(TOKEN_PATH, "utf8").trim();
  if (!token) throw new Error("The 1Password service-account token is empty.");
  return token;
}

function readGitHubIdentity() {
  const serviceToken = readServiceToken();
  const item = JSON.parse(
    run(
      "op",
      ["item", "get", ITEM, "--vault", VAULT, "--format", "json"],
      { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: serviceToken },
    ),
  );
  const identity = readGitHubVaultFields(item.fields);
  if (!identity.appId || !identity.installationId || !identity.privateKey) {
    throw new Error("The GitHub App item is incomplete.");
  }
  return identity;
}

export async function requestInstallationToken(fetchImpl = fetch) {
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
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        repositories: ["sanctuary"],
        permissions: { contents: "write", pull_requests: "write" }
      })
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub installation-token request failed (${response.status}).`);
  }
  const payload = await response.json();
  const repositories = payload.repositories?.map((repo) => repo.full_name) ?? [];
  if (
    !payload.token ||
    repositories.length !== 1 ||
    repositories[0] !== REPOSITORY ||
    payload.permissions?.contents !== "write" ||
    payload.permissions?.pull_requests !== "write"
  ) {
    throw new Error("GitHub returned a token outside the expected repository contract.");
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

async function main() {
  if (process.argv.includes("--git-credential")) {
    if (process.argv.at(-1) !== "get") return;
    const request = readCredentialRequest();
    if (request.protocol !== "https" || request.host !== "github.com") return;
    const result = await requestInstallationToken();
    process.stdout.write(`username=x-access-token\npassword=${result.token}\n`);
    return;
  }

  const result = await requestInstallationToken();
  if (process.argv.includes("--raw")) {
    process.stdout.write(result.token);
    return;
  }
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
  throw new Error("Use --verify, --raw, or --git-credential.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`GitHub App token helper: ERROR — ${error.message}`);
    process.exitCode = 1;
  });
}
