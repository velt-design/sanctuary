import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const portalRoot = path.join(repositoryRoot, "apps", "portal");
const projectRefPath = path.join(
  repositoryRoot,
  "supabase",
  ".temp",
  "project-ref",
);
const stdoutPath = path.join(
  os.tmpdir(),
  "sanctuary-portal-commercial-staging.stdout.log",
);
const stderrPath = path.join(
  os.tmpdir(),
  "sanctuary-portal-commercial-staging.stderr.log",
);
const portalUrl = "http://127.0.0.1:3002";
const supabaseCliVersion = "2.110.0";
const testEmail = "codex-commercial-qa@example.invalid";

const npmCli =
  process.env.npm_execpath ??
  path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
const npxCli = path.join(path.dirname(npmCli), "npx-cli.js");

if (!existsSync(npmCli) || !existsSync(npxCli)) {
  throw new Error("The npm/npx CLI runtime is unavailable.");
}

function runNodeCli(cli, args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
}

function npx(args) {
  return runNodeCli(npxCli, [
    "--yes",
    `supabase@${supabaseCliVersion}`,
    ...args,
  ]);
}

function successfulJson(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed; sensitive command output was withheld.`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function readStagingCredentials() {
  const projectRef = readFileSync(projectRefPath, "utf8").trim();
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("The linked Supabase project reference is invalid.");
  }

  const projects = successfulJson(
    npx(["projects", "list", "--output", "json"]),
    "Supabase project classification",
  );
  const project = projects.find((entry) => entry?.ref === projectRef);
  const projectName = String(project?.name ?? "");
  if (
    !project?.linked ||
    project?.status !== "ACTIVE_HEALTHY" ||
    !/staging/i.test(projectName) ||
    /prod(uction)?/i.test(projectName)
  ) {
    throw new Error(
      "The linked Supabase project is not positively classified as healthy staging.",
    );
  }

  const keys = successfulJson(
    npx([
      "projects",
      "api-keys",
      "--project-ref",
      projectRef,
      "--reveal",
      "--output",
      "json",
    ]),
    "Supabase staging API-key lookup",
  );
  const anonKey = keys.find((entry) => entry?.name === "anon")?.api_key;
  const serviceRoleKey = keys.find(
    (entry) => entry?.name === "service_role",
  )?.api_key;
  if (!anonKey || !serviceRoleKey) {
    throw new Error("Staging anon/service-role keys were unavailable.");
  }

  return {
    projectRef,
    anonKey,
    serviceRoleKey,
  };
}

function requireSuccess(result, label, { inheritOutput = false } = {}) {
  if (result.status === 0) return;
  if (inheritOutput) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
  throw new Error(`${label} failed; sensitive command output was withheld.`);
}

function assertNoQuoteArtifactFailure() {
  const serverErrors = readFileSync(stderrPath, "utf8");
  if (
    serverErrors.includes("[quote_artifacts] failed") ||
    serverErrors.includes("Missing font file")
  ) {
    throw new Error(
      `Commercial staging quote artifact refresh failed; inspect ${stderrPath}.`,
    );
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function stopPortal(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32") {
    const stopped = spawnSync(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    if (stopped.status !== 0 && child.exitCode === null) {
      child.kill();
    }
  } else {
    child.kill("SIGTERM");
  }
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null) child.kill();
  child.unref();
}

async function waitForPortal(child) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${portalUrl}/login`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) return;
    } catch {
      // Keep polling until the bounded readiness deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `The staging portal did not become ready; inspect ${stderrPath}.`,
  );
}

const { projectRef, anonKey, serviceRoleKey } = readStagingCredentials();
const testPassword =
  createHash("sha256")
    .update(`commercial-qa|${serviceRoleKey}`)
    .digest("base64") + "!Aa9";

const sharedEnvironment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  PORTAL_TEST_EMAIL: testEmail,
  PORTAL_TEST_PASSWORD: testPassword,
  PORTAL_TEST_ROLE: "staff",
  PORTAL_TEST_PROVISION_TARGET: "staging",
  PORTAL_TEST_SCENARIO_TARGET: "staging",
  PORTAL_SCENARIOS: "quote-ready",
  PORTAL_SCENARIO_PREFIX: "commercialqa",
  PORTAL_BASE_URL: portalUrl,
  PORTAL_COMMERCIAL_STAGING_MUTATIONS: "1",
};

for (const providerVariable of [
  "RESEND_API_KEY",
  "RESEND_API_KEY_PREVIEW",
  "RESEND_WEBHOOK_SECRET",
]) {
  delete sharedEnvironment[providerVariable];
}
sharedEnvironment.EMAIL_PREVIEW_ENABLED = "false";

requireSuccess(
  runNodeCli(npmCli, ["run", "portal:test-user:ensure"], {
    env: sharedEnvironment,
  }),
  "Staging test-user provisioning",
);
requireSuccess(
  runNodeCli(npmCli, ["run", "portal:scenarios:ensure"], {
    env: sharedEnvironment,
  }),
  "Staging scenario provisioning",
);
process.stdout.write(
  "commercial-staging-smoke: deterministic user and quote scenario ready\n",
);

const nextBin = path.join(
  repositoryRoot,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const stdout = openSync(stdoutPath, "a");
const stderr = openSync(stderrPath, "w");
const portal = spawn(
  process.execPath,
  [nextBin, "dev", "--webpack", "-p", "3002"],
  {
    cwd: portalRoot,
    env: {
      ...sharedEnvironment,
      PORTAL_PLAYWRIGHT_DIST_DIR: ".next-staging-commercial",
    },
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  },
);
closeSync(stdout);
closeSync(stderr);

let executionError;
try {
  await waitForPortal(portal);
  process.stdout.write(
    "commercial-staging-smoke: isolated portal ready against staging\n",
  );
  const browser = runNodeCli(
    npmCli,
    ["run", "test:portal:commercial:staging:browser"],
    {
      env: sharedEnvironment,
      stdio: "inherit",
      encoding: undefined,
    },
  );
  requireSuccess(browser, "Commercial staging browser smoke", {
    inheritOutput: true,
  });
  assertNoQuoteArtifactFailure();
  process.stdout.write(
    "commercial-staging-smoke: authenticated quote read/update/recovery/artifact contract passed\n",
  );
} catch (error) {
  executionError = error;
} finally {
  await stopPortal(portal);
}

if (executionError) throw executionError;
