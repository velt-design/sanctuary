import { createSign } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXPECTED_USER = "sanctuary-runner";
const EXPECTED_VAULT = "Sanctuary - Node Runtime";
const EXPECTED_GITHUB_ITEM = "GitHub - Sanctuary Node PR Bot";
const EXPECTED_REPOSITORY = "velt-design/sanctuary";
const REQUIRED_GITHUB_PERMISSIONS = {
  contents: "write",
  metadata: "read",
  pull_requests: "write",
};

function result(status, detail) {
  return { status, detail };
}

export function evaluateMachineCredentialEvidence(evidence) {
  const visibleVaults = evidence.onePasswordVaults ?? [];
  const githubPermissions = evidence.githubPermissions ?? {};
  const expectedPermissionSet = Object.entries(REQUIRED_GITHUB_PERMISSIONS).every(
    ([name, level]) => githubPermissions[name] === level,
  );
  const unexpectedPermissions = Object.entries(githubPermissions).filter(
    ([name, level]) => !(name in REQUIRED_GITHUB_PERMISSIONS) && level !== "none",
  );

  const checks = {
    runtimeUser:
      evidence.runtimeUser === EXPECTED_USER
        ? result("pass", "Credentials are scoped to the non-admin runtime account")
        : result("fail", "Gate is not running as the expected runtime account"),
    onePasswordCli: evidence.onePasswordCliReady
      ? result("pass", "1Password CLI supports service accounts")
      : result("fail", "1Password CLI 2.18.0 or later is not available"),
    onePasswordBootstrap: evidence.onePasswordTokenFileProtected
      ? result("pass", "The unattended service-account token file is owner-readable only")
      : result("fail", "The service-account token file is missing or has broad permissions"),
    onePasswordVaultScope:
      visibleVaults.length === 1 && visibleVaults[0] === EXPECTED_VAULT
        ? result("pass", "The service account can see only the node runtime vault")
        : result("fail", "The service account is not restricted to the node runtime vault"),
    onePasswordReadOnly: evidence.onePasswordReadOnlyAttested
      ? result("pass", "Read-only service-account permissions were operator-attested")
      : result("fail", "Read-only service-account permissions need operator attestation"),
    githubVaultItem: evidence.githubVaultItemPresent
      ? result("pass", "GitHub App identity material is read from the restricted runtime vault")
      : result("fail", "GitHub App identity material is incomplete in the runtime vault"),
    githubRepository:
      evidence.githubRepository === EXPECTED_REPOSITORY
        ? result("pass", "GitHub App installation is restricted to Sanctuary")
        : result("fail", "GitHub App repository scope is not verified"),
    githubPermissions:
      expectedPermissionSet && unexpectedPermissions.length === 0
        ? result("pass", "GitHub App has only contents and pull-request write access")
        : result("fail", "GitHub App permissions are missing or broader than the contract"),
  };

  return {
    schemaVersion: 1,
    gate: "mac-machine-credentials",
    passed: Object.values(checks).every((check) => check.status === "pass"),
    checks,
  };
}

function run(command, args = [], env = process.env) {
  const execution = spawnSync(command, args, { encoding: "utf8", env });
  return {
    ok: execution.status === 0,
    stdout: execution.stdout?.trim() ?? "",
  };
}

function readServiceAccountToken() {
  const path = join(
    homedir(),
    ".openclaw",
    "credentials",
    "onepassword",
    "service-account-token",
  );
  try {
    const stats = statSync(path);
    const protectedFile = stats.isFile() && (stats.mode & 0o077) === 0;
    const token = protectedFile ? readFileSync(path, "utf8").trim() : null;
    return { token, protectedFile: Boolean(token) && protectedFile };
  } catch {
    return { token: null, protectedFile: false };
  }
}

function versionAtLeast(actual, minimum) {
  const actualParts = actual.split(".").map(Number);
  const minimumParts = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
    const difference = (actualParts[index] ?? 0) - (minimumParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

export function readGitHubVaultFields(fields = []) {
  const readField = (...names) =>
    fields.find(
      (field) => names.includes(field.id) || names.includes(field.label),
    )?.value ?? null;
  return {
    appId: readField("app_id", "username"),
    installationId: readField("installation_id"),
    privateKey: readField("private_key", "password"),
  };
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createGitHubAppJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encodeJwtPart({ alg: "RS256", typ: "JWT" })}.${encodeJwtPart({
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

async function verifyGitHubInstallation(appId, installationId, privateKey) {
  try {
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${createGitHubAppJwt(appId, privateKey)}`,
          "Content-Type": "application/json",
          "User-Agent": "sanctuary-mac-credential-gate",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          repositories: ["sanctuary"],
          permissions: { contents: "write", pull_requests: "write" },
        }),
      },
    );
    if (!response.ok) return { repository: null, permissions: null };

    const payload = await response.json();
    const repository = payload.repositories?.[0]?.full_name ?? null;
    return { repository, permissions: payload.permissions ?? null };
  } catch {
    return { repository: null, permissions: null };
  }
}

async function collectMacEvidence() {
  if (process.platform !== "darwin") {
    throw new Error("This gate must be run on the Mac mini.");
  }

  const runtimeUser = run("/usr/bin/id", ["-un"]).stdout;
  const opVersion = run("op", ["--version"]);
  const onePasswordBootstrap = readServiceAccountToken();
  const onePasswordToken = onePasswordBootstrap.token;
  let onePasswordVaults = [];
  if (opVersion.ok && onePasswordToken) {
    const vaultList = run("op", ["vault", "list", "--format", "json"], {
      ...process.env,
      OP_SERVICE_ACCOUNT_TOKEN: onePasswordToken,
    });
    if (vaultList.ok) {
      try {
        onePasswordVaults = JSON.parse(vaultList.stdout).map((vault) => vault.name).sort();
      } catch {
        onePasswordVaults = [];
      }
    }
  }

  let githubAppId = null;
  let githubInstallationId = null;
  let githubPrivateKey = null;
  if (opVersion.ok && onePasswordToken) {
    const githubItem = run(
      "op",
      [
        "item",
        "get",
        EXPECTED_GITHUB_ITEM,
        "--vault",
        EXPECTED_VAULT,
        "--format",
        "json",
      ],
      { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: onePasswordToken },
    );
    if (githubItem.ok) {
      try {
        const fields = readGitHubVaultFields(
          JSON.parse(githubItem.stdout).fields ?? [],
        );
        githubAppId = fields.appId;
        githubInstallationId = fields.installationId;
        githubPrivateKey = fields.privateKey;
      } catch {
        // The public report below records only that the item was incomplete.
      }
    }
  }
  const githubVaultItemPresent = Boolean(
    githubAppId && githubInstallationId && githubPrivateKey,
  );
  const github = githubVaultItemPresent
    ? await verifyGitHubInstallation(githubAppId, githubInstallationId, githubPrivateKey)
    : { repository: null, permissions: null };

  return {
    runtimeUser,
    onePasswordCliReady: opVersion.ok && versionAtLeast(opVersion.stdout, "2.18.0"),
    onePasswordTokenFileProtected: onePasswordBootstrap.protectedFile,
    onePasswordVaults,
    onePasswordReadOnlyAttested: process.argv.includes("--attest-op-read-only"),
    githubVaultItemPresent,
    githubRepository: github.repository,
    githubPermissions: github.permissions,
  };
}

function printHuman(report) {
  console.log(`Mac machine credential gate: ${report.passed ? "PASS" : "FAIL"}`);
  for (const [name, check] of Object.entries(report.checks)) {
    console.log(`- ${name}: ${check.status.toUpperCase()} — ${check.detail}`);
  }
}

async function main() {
  const report = evaluateMachineCredentialEvidence(await collectMacEvidence());
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  process.exitCode = report.passed ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`Mac machine credential gate: ERROR — ${error.message}`);
    process.exitCode = 2;
  });
}
