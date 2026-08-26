import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SANCTUARY_REPOSITORY = "velt-design/sanctuary";
export const SANCTUARY_MAIN_BRANCH = "main";
export const FOUNDATION_CHECK = "Autonomous Engineering Foundation";
export const INITIAL_REQUIRED_CHECKS = Object.freeze([
  "Portal Performance Report",
  "Portal Quality",
]);

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function requiredChecks({ promoteFoundation = false } = {}) {
  return sorted([
    ...INITIAL_REQUIRED_CHECKS,
    ...(promoteFoundation ? [FOUNDATION_CHECK] : []),
  ]);
}

export function buildMainProtectionPolicy(options = {}) {
  return {
    required_status_checks: {
      strict: true,
      contexts: requiredChecks(options),
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      required_approving_review_count: 0,
      require_last_push_approval: false,
    },
    restrictions: null,
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_conversation_resolution: true,
    lock_branch: false,
    allow_fork_syncing: false,
  };
}

function logins(entries) {
  if (!Array.isArray(entries)) return [];
  return sorted(
    entries
      .map((entry) => entry?.login ?? entry?.slug ?? entry?.name)
      .filter(Boolean),
  );
}

function enabled(value) {
  return value?.enabled === true;
}

export function mainProtectionSnapshot(protection) {
  if (!protection) return null;
  const reviews = protection.required_pull_request_reviews;
  const restrictions = protection.restrictions;
  return {
    requiredChecks: sorted(
      protection.required_status_checks?.contexts ??
        protection.required_status_checks?.checks?.map(
          (check) => check.context,
        ) ??
        [],
    ),
    strictChecks: protection.required_status_checks?.strict === true,
    enforceAdmins: enabled(protection.enforce_admins),
    pullRequestRequired: Boolean(reviews),
    requiredApprovals: reviews?.required_approving_review_count ?? null,
    dismissStaleReviews: reviews?.dismiss_stale_reviews === true,
    requireCodeOwnerReviews: reviews?.require_code_owner_reviews === true,
    requireLastPushApproval: reviews?.require_last_push_approval === true,
    reviewBypassUsers: logins(reviews?.bypass_pull_request_allowances?.users),
    reviewBypassTeams: logins(reviews?.bypass_pull_request_allowances?.teams),
    reviewBypassApps: logins(reviews?.bypass_pull_request_allowances?.apps),
    restrictionsConfigured: Boolean(restrictions),
    restrictedUsers: logins(restrictions?.users),
    restrictedTeams: logins(restrictions?.teams),
    restrictedApps: logins(restrictions?.apps),
    linearHistory: enabled(protection.required_linear_history),
    forcePushesAllowed: enabled(protection.allow_force_pushes),
    deletionsAllowed: enabled(protection.allow_deletions),
    creationsBlocked: enabled(protection.block_creations),
    conversationResolutionRequired: enabled(
      protection.required_conversation_resolution,
    ),
    branchLocked: enabled(protection.lock_branch),
    forkSyncAllowed: enabled(protection.allow_fork_syncing),
  };
}

export function expectedMainProtectionSnapshot(options = {}) {
  return {
    requiredChecks: requiredChecks(options),
    strictChecks: true,
    enforceAdmins: true,
    pullRequestRequired: true,
    requiredApprovals: 0,
    dismissStaleReviews: false,
    requireCodeOwnerReviews: false,
    requireLastPushApproval: false,
    reviewBypassUsers: [],
    reviewBypassTeams: [],
    reviewBypassApps: [],
    restrictionsConfigured: false,
    restrictedUsers: [],
    restrictedTeams: [],
    restrictedApps: [],
    linearHistory: true,
    forcePushesAllowed: false,
    deletionsAllowed: false,
    creationsBlocked: false,
    conversationResolutionRequired: true,
    branchLocked: false,
    forkSyncAllowed: false,
  };
}

export function compareMainProtection(protection, options = {}) {
  const actual = mainProtectionSnapshot(protection);
  const expected = expectedMainProtectionSnapshot(options);
  return {
    matches: JSON.stringify(actual) === JSON.stringify(expected),
    expected,
    actual,
  };
}

function runGitHub(args, { input = null, allowNotFound = false } = {}) {
  const binary = process.env.SANCTUARY_MAIN_PROTECTION_GH_BINARY ?? "gh";
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    input,
    env: { ...process.env, GH_PROMPT_DISABLED: "1" },
  });
  if (result.status !== 0) {
    const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
    if (allowNotFound && /HTTP 404|not protected/i.test(output)) return null;
    throw new Error(output.trim() || "The GitHub API command failed.");
  }
  if (!result.stdout.trim()) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("The GitHub API returned invalid JSON.");
  }
}

export function readMainProtection(run = runGitHub) {
  return run(
    [
      "api",
      `repos/${SANCTUARY_REPOSITORY}/branches/${SANCTUARY_MAIN_BRANCH}/protection`,
    ],
    { allowNotFound: true },
  );
}

export function assertFoundationCheckPromotable(run = runGitHub) {
  const workflow = run([
    "api",
    `repos/${SANCTUARY_REPOSITORY}/actions/workflows/autonomous-engineering.yml`,
  ]);
  if (
    workflow?.state !== "active" ||
    workflow?.path !== ".github/workflows/autonomous-engineering.yml"
  ) {
    throw new Error(
      "The foundation workflow is not active on the default branch.",
    );
  }
  const result = run([
    "api",
    `repos/${SANCTUARY_REPOSITORY}/commits/${SANCTUARY_MAIN_BRANCH}/check-runs?filter=latest&per_page=100`,
  ]);
  const matches = (result?.check_runs ?? []).filter(
    (check) => check.name === FOUNDATION_CHECK,
  );
  if (
    matches.length !== 1 ||
    matches[0].status !== "completed" ||
    matches[0].conclusion !== "success"
  ) {
    throw new Error(
      "The foundation check has not passed exactly once on the current main revision.",
    );
  }
}

export function assertSoleHumanMergeAuthority(run = runGitHub) {
  const repository = run(["api", `repos/${SANCTUARY_REPOSITORY}`]);
  if (
    repository?.owner?.login !== "velt-design" ||
    repository?.owner?.type !== "User" ||
    repository?.permissions?.admin !== true
  ) {
    throw new Error(
      "The Sanctuary repository is not the expected owner-admin personal repository.",
    );
  }
  const collaborators = run([
    "api",
    `repos/${SANCTUARY_REPOSITORY}/collaborators?affiliation=all&per_page=100`,
  ]);
  const writers = (collaborators ?? []).filter(
    (entry) =>
      entry?.permissions?.push === true ||
      entry?.permissions?.maintain === true ||
      entry?.permissions?.admin === true,
  );
  if (
    writers.length !== 1 ||
    writers[0]?.login !== "velt-design" ||
    writers[0]?.type !== "User"
  ) {
    throw new Error(
      "The personal repository no longer has exactly one human write authority.",
    );
  }
}

export function applyMainProtection(options = {}, run = runGitHub) {
  assertSoleHumanMergeAuthority(run);
  if (options.promoteFoundation) assertFoundationCheckPromotable(run);
  const policy = buildMainProtectionPolicy(options);
  return run(
    [
      "api",
      "--method",
      "PUT",
      `repos/${SANCTUARY_REPOSITORY}/branches/${SANCTUARY_MAIN_BRANCH}/protection`,
      "--input",
      "-",
    ],
    { input: `${JSON.stringify(policy)}\n` },
  );
}

function parseArguments(args) {
  const allowed = new Set(["--check", "--apply", "--promote-foundation"]);
  if (args.some((arg) => !allowed.has(arg))) {
    throw new Error(
      "Use --check or --apply, optionally with --promote-foundation.",
    );
  }
  const modes = ["--check", "--apply"].filter((mode) => args.includes(mode));
  if (modes.length !== 1) {
    throw new Error("Exactly one of --check or --apply is required.");
  }
  return {
    mode: modes[0],
    promoteFoundation: args.includes("--promote-foundation"),
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "--apply") applyMainProtection(options);
  assertSoleHumanMergeAuthority();
  const comparison = compareMainProtection(readMainProtection(), options);
  console.log(JSON.stringify(comparison, null, 2));
  if (!comparison.matches) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`GitHub main protection: ERROR - ${error.message}`);
    process.exitCode = 1;
  }
}
