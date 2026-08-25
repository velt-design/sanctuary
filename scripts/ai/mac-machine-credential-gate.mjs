#!/usr/bin/env node

import { createSign } from "node:crypto";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXPECTED_USER = "sanctuary-runner";
const EXPECTED_VAULT = "Sanctuary - Node Runtime";
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
    onePasswordBootstrap: evidence.onePasswordKeychainItemPresent
      ? result("pass", "The service-account bootstrap token is held in macOS Keychain")
      : result("fail", "The service-account bootstrap token is not available from Keychain"),
    onePasswordVaultScope:
      visibleVaults.length === 1 && visibleVaults[0] === EXPECTED_VAULT
        ? result("pass", "The service account can see only the node runtime vault")
        : result("fail", "The service account is not restricted to the node runtime vault"),
    onePasswordReadOnly: evidence.onePasswordReadOnlyAttested
      ? result("pass", "Read-only service-account permissions were operator-attested")
      : result("fail", "Read-only service-account permissions need operator attestation"),
    githubKeychain: evidence.githubKeychainItemsPresent
      ? result("pass", "GitHub App identity material is held in macOS Keychain")
      : result("fail", "GitHub App identity material is incomplete in Keychain"),
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

function readKeychainSecret(service) {
  const lookup = run("/usr/bin/security", [
    "find-generic-password",
    "-a",
    EXPECTED_USER,
    "-s",
    service,
    "-w",
    "/Library/Keychains/System.keychain",
  ]);
  return lookup.ok ? lookup.stdout : null;
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

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createGitHubAppJwt(appId, privateKey) {
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
  const onePasswordToken = readKeychainSecret("sanctuary.1password.service-account");
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

  const githubAppId = readKeychainSecret("sanctuary.github.app-id");
  const githubInstallationId = readKeychainSecret("sanctuary.github.installation-id");
  const githubPrivateKey = readKeychainSecret("sanctuary.github.private-key");
  const githubKeychainItemsPresent = Boolean(
    githubAppId && githubInstallationId && githubPrivateKey,
  );
  const github = githubKeychainItemsPresent
    ? await verifyGitHubInstallation(githubAppId, githubInstallationId, githubPrivateKey)
    : { repository: null, permissions: null };

  return {
    runtimeUser,
    onePasswordCliReady: opVersion.ok && versionAtLeast(opVersion.stdout, "2.18.0"),
    onePasswordKeychainItemPresent: Boolean(onePasswordToken),
    onePasswordVaults,
    onePasswordReadOnlyAttested: process.argv.includes("--attest-op-read-only"),
    githubKeychainItemsPresent,
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
