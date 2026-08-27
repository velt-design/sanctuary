// @vitest-environment node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupEngineeringLane,
  provisionEngineeringLane,
  publishEngineeringLane,
  statusEngineeringLane,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/lane-runtime.mjs";
import { createGitRuntime } from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/lane-git.mjs";
import {
  assertChangedPathsOwned,
  matchesRepoPattern,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/lane-contract.mjs";
import { assertSafeGitHubCommand } from "../scripts/ai/github-app-token.mjs";

type Manifest = Record<string, any>;

const temporaryDirectories: string[] = [];

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

function contractAdapter() {
  return {
    resolve(input: Manifest) {
      const manifest = JSON.parse(JSON.stringify(input));
      const digest = createHash("sha256")
        .update(`${JSON.stringify(manifest, null, 2)}\n`)
        .digest("hex");
      return { manifest, manifestHash: `sha256:${digest}` };
    },
    render(manifest: Manifest) {
      return `# Fixture worker prompt\n\n${manifest.taskId}\n`;
    },
  };
}

function createManifest(
  baseSha: string,
  suffix = "lane_provisioning",
): Manifest {
  return {
    schema: "sanctuary-engineering-task-v1",
    taskId: `eng_20260826_${suffix}`,
    goalId: "goal_20260826_autonomous_engineering",
    objective: "Prove deterministic engineering lane behavior.",
    requestedBy: "Test operator",
    base: { ref: "main", sha: baseSha },
    branch: `ai/test-${suffix.replaceAll("_", "-")}`,
    risk: "low",
    ownerLane: "ai-engineering-lanes",
    roles: {
      supervisor: "engineering_lead",
      worker: "coding_worker",
      reviewer: "code_reviewer",
    },
    readFirst: ["AGENTS.md"],
    ownedPaths: ["src/**"],
    excludedPaths: ["docs/private/**", "supabase/**"],
    dependencies: [],
    acceptanceCriteria: ["The lane is deterministic."],
    verification: {
      focusedCommands: ["npm test"],
      ciChecks: ["Fixture CI"],
      visualEvidence: { required: false, scenarios: [] },
    },
    limits: {
      maxWorkers: 1,
      maxAttempts: 2,
      workerTimeoutMinutes: 30,
      maxCostCents: 100,
    },
    approvals: {
      planning: "approved",
      merge: "human_required",
      scopeExpansion: "human_required",
      production: "prohibited",
    },
    outputs: { draftPullRequest: true, completionReport: true },
    stopConditions: ["The lane identity does not match."],
  };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sanctuary-engineering-lane-"));
  temporaryDirectories.push(root);
  const origin = join(root, "origin.git");
  const repoRoot = join(root, "controller");
  const stateDir = join(root, "state");
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  git(root, ["init", "--bare", origin]);
  git(repoRoot, ["init", "-b", "main"]);
  git(repoRoot, ["config", "user.name", "Sanctuary Lane Test"]);
  git(repoRoot, ["config", "user.email", "lane-test@example.invalid"]);
  writeFileSync(join(repoRoot, "AGENTS.md"), "# Fixture\n", "utf8");
  git(repoRoot, ["add", "AGENTS.md"]);
  git(repoRoot, ["commit", "-m", "fixture base"]);
  git(repoRoot, ["remote", "add", "origin", origin]);
  git(repoRoot, ["push", "-u", "origin", "main"]);
  const baseSha = git(repoRoot, ["rev-parse", "HEAD"]);
  const runtimeOwner = join(stateDir, "sanctuary-engineering-owner.json");
  writeFileSync(
    runtimeOwner,
    `${JSON.stringify({ schemaVersion: 1, profile: "sanctuary-engineering" })}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  chmodSync(runtimeOwner, 0o600);

  let pullRequest: Record<string, unknown> | null = null;
  const baseGit = createGitRuntime({
    repoRoot,
    stateDir,
    expectedRemoteUrl: origin,
    authenticated: false,
  });
  const gitRuntime = {
    ...baseGit,
    findOpenPullRequest: () => pullRequest,
    createDraftPullRequest: ({ branch, baseRef }: any) => {
      pullRequest = {
        number: 99,
        url: "https://github.com/velt-design/sanctuary/pull/99",
        isDraft: true,
        headRefName: branch,
        baseRefName: baseRef,
      };
      return pullRequest;
    },
  };
  const options = {
    repoRoot,
    stateDir,
    gitRuntime,
    contractAdapter: contractAdapter(),
    authenticatedGit: false,
    now: () => new Date("2026-08-26T00:00:00.000Z"),
  };
  return { root, origin, repoRoot, stateDir, baseSha, options };
}

function commitOwnedChange(worktreePath: string) {
  mkdirSync(join(worktreePath, "src"), { recursive: true });
  writeFileSync(join(worktreePath, "src", "result.txt"), "complete\n", "utf8");
  git(worktreePath, ["add", "src/result.txt"]);
  git(worktreePath, ["commit", "-m", "test: complete lane"]);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("engineering lane provisioning", () => {
  it("creates one exact branch/worktree and resumes it idempotently", () => {
    const setup = fixture();
    const manifest = createManifest(setup.baseSha);
    const first = provisionEngineeringLane(manifest, setup.options);

    expect(first).toMatchObject({
      taskId: manifest.taskId,
      state: "active",
      branch: manifest.branch,
      baseSha: setup.baseSha,
      headSha: setup.baseSha,
      clean: true,
      resumed: false,
    });
    expect(first.workerPrompt).toContain(first.manifestHash);
    expect(first.workerPrompt).toContain(resolve(first.worktreePath));
    expect(git(first.worktreePath, ["branch", "--show-current"])).toBe(
      manifest.branch,
    );

    const resumed = provisionEngineeringLane(manifest, setup.options);
    expect(resumed).toMatchObject({
      state: "active",
      headSha: setup.baseSha,
      worktreePath: first.worktreePath,
      resumed: true,
    });
  });

  it("refuses a changed base, an unowned branch, and a second active lane", () => {
    const badBaseSetup = fixture();
    const badBase = createManifest("0".repeat(40), "bad_base");
    expect(() =>
      provisionEngineeringLane(badBase, badBaseSetup.options),
    ).toThrow(/not the manifest base/);

    const branchSetup = fixture();
    const branchManifest = createManifest(
      branchSetup.baseSha,
      "existing_branch",
    );
    git(branchSetup.repoRoot, ["branch", branchManifest.branch]);
    expect(() =>
      provisionEngineeringLane(branchManifest, branchSetup.options),
    ).toThrow(/unowned local branch/);

    const activeSetup = fixture();
    const first = createManifest(activeSetup.baseSha, "first_active");
    provisionEngineeringLane(first, activeSetup.options);
    const second = createManifest(activeSetup.baseSha, "second_active");
    expect(() => provisionEngineeringLane(second, activeSetup.options)).toThrow(
      /Another engineering lane is active/,
    );
  });

  it("reports dirty state without mutating the worktree", () => {
    const setup = fixture();
    const manifest = createManifest(setup.baseSha, "status_dirty");
    const lane = provisionEngineeringLane(manifest, setup.options);
    writeFileSync(join(lane.worktreePath, "untracked.txt"), "dirty\n", "utf8");

    const status = statusEngineeringLane(
      manifest.taskId,
      lane.manifestHash,
      setup.options,
    );
    expect(status.clean).toBe(false);
    expect(existsSync(join(lane.worktreePath, "untracked.txt"))).toBe(true);
  });
});

describe("engineering lane publication and cleanup", () => {
  it("pushes only the owned feature branch, records a draft PR, and safely removes only its worktree", () => {
    const setup = fixture();
    const manifest = createManifest(setup.baseSha, "publish_cleanup");
    const lane = provisionEngineeringLane(manifest, setup.options);
    commitOwnedChange(lane.worktreePath);

    const published = publishEngineeringLane(
      {
        taskId: manifest.taskId,
        manifestHash: lane.manifestHash,
        title: "test(ai): publish fixture lane",
        body: "This draft pull request proves the fixture lane publication contract.",
      },
      setup.options,
    );
    expect(published).toMatchObject({
      state: "published",
      branch: manifest.branch,
      clean: true,
      pullRequest: {
        number: 99,
        url: "https://github.com/velt-design/sanctuary/pull/99",
        draft: true,
      },
    });
    expect(
      git(setup.origin, ["rev-parse", `refs/heads/${manifest.branch}`]),
    ).toBe(published.headSha);

    const cleaned = cleanupEngineeringLane(
      manifest.taskId,
      lane.manifestHash,
      setup.options,
    );
    expect(cleaned.state).toBe("worktree_removed");
    expect(existsSync(lane.worktreePath)).toBe(false);
    expect(
      git(setup.repoRoot, ["rev-parse", `refs/heads/${manifest.branch}`]),
    ).toBe(published.headSha);
    expect(
      cleanupEngineeringLane(manifest.taskId, lane.manifestHash, setup.options)
        .state,
    ).toBe("worktree_removed");
  });

  it("refuses dirty or outside-lane changes before any push", () => {
    const dirtySetup = fixture();
    const dirtyManifest = createManifest(dirtySetup.baseSha, "dirty_publish");
    const dirtyLane = provisionEngineeringLane(
      dirtyManifest,
      dirtySetup.options,
    );
    writeFileSync(join(dirtyLane.worktreePath, "dirty.txt"), "dirty\n", "utf8");
    expect(() =>
      publishEngineeringLane(
        {
          taskId: dirtyManifest.taskId,
          manifestHash: dirtyLane.manifestHash,
          title: "test(ai): reject dirty lane",
          body: "This body is long enough for the strict draft PR contract.",
        },
        dirtySetup.options,
      ),
    ).toThrow(/Commit or remove every worktree change/);

    const scopeSetup = fixture();
    const scopeManifest = createManifest(scopeSetup.baseSha, "scope_publish");
    const scopeLane = provisionEngineeringLane(
      scopeManifest,
      scopeSetup.options,
    );
    mkdirSync(join(scopeLane.worktreePath, "docs"), { recursive: true });
    writeFileSync(
      join(scopeLane.worktreePath, "docs", "outside.md"),
      "outside\n",
    );
    git(scopeLane.worktreePath, ["add", "docs/outside.md"]);
    git(scopeLane.worktreePath, ["commit", "-m", "test: outside lane"]);
    expect(() =>
      publishEngineeringLane(
        {
          taskId: scopeManifest.taskId,
          manifestHash: scopeLane.manifestHash,
          title: "test(ai): reject scope drift",
          body: "This body is long enough for the strict draft PR contract.",
        },
        scopeSetup.options,
      ),
    ).toThrow(/outside the manifest lane/);
    expect(
      git(scopeSetup.repoRoot, [
        "ls-remote",
        "--heads",
        "origin",
        `refs/heads/${scopeManifest.branch}`,
      ]),
    ).toBe("");
  });
});

describe("lane policy helpers", () => {
  it("matches repository globs and gives exclusions precedence", () => {
    expect(matchesRepoPattern("src/a/b.ts", "src/**")).toBe(true);
    expect(matchesRepoPattern("src/a.ts", "src/*.ts")).toBe(true);
    expect(matchesRepoPattern("docs/a.md", "src/**")).toBe(false);
    expect(() =>
      assertChangedPathsOwned(["supabase/unsafe.sql"], {
        ownedPaths: ["**"],
        excludedPaths: ["supabase/**"],
      }),
    ).toThrow(/outside the manifest lane/);
  });

  it("allows repository reads and draft creation but rejects merge authority", () => {
    expect(() =>
      assertSafeGitHubCommand([
        "pr",
        "list",
        "--repo",
        "velt-design/sanctuary",
        "--state",
        "open",
      ]),
    ).not.toThrow();
    expect(() =>
      assertSafeGitHubCommand([
        "pr",
        "create",
        "--repo",
        "velt-design/sanctuary",
        "--draft",
        "--base",
        "main",
        "--head",
        "ai/test-safe-draft",
        "--title",
        "Safe draft",
        "--body",
        "Draft evidence only.",
      ]),
    ).not.toThrow();
    expect(() =>
      assertSafeGitHubCommand([
        "pr",
        "merge",
        "99",
        "--repo",
        "velt-design/sanctuary",
      ]),
    ).toThrow(/outside the engineering read\/draft policy/);
    expect(() =>
      assertSafeGitHubCommand([
        "pr",
        "create",
        "--repo",
        "velt-design/sanctuary",
        "--base",
        "main",
        "--head",
        "ai/not-draft",
        "--title",
        "Unsafe",
        "--body",
        "Missing the required draft flag.",
      ]),
    ).toThrow(/requires --draft/);
    expect(() =>
      assertSafeGitHubCommand([
        "pr",
        "create",
        "--repo",
        "velt-design/sanctuary",
        "--draft",
        "--base",
        "main",
        "--head",
        "ai/safe-first",
        "--head",
        "main",
        "--title",
        "Duplicate head",
        "--body",
        "Duplicate security-sensitive flags must fail closed.",
      ]),
    ).toThrow(/requires --head/);
  });
});
