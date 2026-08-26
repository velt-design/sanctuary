// @vitest-environment node

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyFailureLog,
  createGitHubCiRuntime,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/ci-runtime.mjs";
import { watchEngineeringCi } from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-ci-watch.mjs";
import {
  changedPathsForEvent,
  routeEngineeringCi,
} from "../scripts/ai/engineering-ci-route.mjs";

type Value = Record<string, any>;

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);

function manifest() {
  return {
    taskId: "eng_20260826_ci_review_fixture",
    branch: "ai/test-ci-review-fixture",
    base: { ref: "main", sha: baseSha },
    verification: { ciChecks: ["Fixture CI"] },
  };
}

function completion() {
  return {
    headSha,
    pullRequest: {
      number: 123,
      url: "https://github.com/velt-design/sanctuary/pull/123",
      draft: true,
    },
  };
}

function check(conclusion: string, patch: Value = {}): Value {
  return {
    __typename: "CheckRun",
    name: "Fixture CI",
    status: "COMPLETED",
    conclusion,
    detailsUrl:
      "https://github.com/velt-design/sanctuary/actions/runs/456/job/789",
    workflowName: "Fixture workflow",
    startedAt: "2026-08-26T00:00:00Z",
    completedAt: "2026-08-26T00:01:00Z",
    ...patch,
  };
}

function pullRequest(statusCheckRollup: Value[]) {
  return {
    number: 123,
    url: "https://github.com/velt-design/sanctuary/pull/123",
    state: "OPEN",
    isDraft: true,
    baseRefName: "main",
    baseRefOid: baseSha,
    headRefName: "ai/test-ci-review-fixture",
    headRefOid: headSha,
    statusCheckRollup,
  };
}

class FakeGit {
  calls: string[][] = [];
  currentPullRequest: Value;
  failedLog = "stable assertion failure";
  diffOutput = "diff --git a/docs/a.md b/docs/a.md\n+safe change\n";

  constructor(checks: Value[]) {
    this.currentPullRequest = pullRequest(checks);
  }

  safeGh = (args: string[]) => {
    this.calls.push([...args]);
    if (args[0] === "pr" && args[1] === "view") {
      return { stdout: JSON.stringify(this.currentPullRequest) };
    }
    if (args[0] === "run" && args[1] === "view") {
      return { stdout: this.failedLog };
    }
    if (args[0] === "pr" && args[1] === "diff") {
      return { stdout: this.diffOutput };
    }
    if (args[0] === "run" && args[1] === "rerun") {
      return { stdout: "" };
    }
    if (args[0] === "workflow" && args[1] === "run") {
      return { stdout: "" };
    }
    throw new Error(`Unexpected gh call: ${args.join(" ")}`);
  };
}

function runtime(checks: Value[]) {
  const git = new FakeGit(checks);
  return {
    git,
    ci: createGitHubCiRuntime({ gitRuntime: git }),
  };
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "git failed");
  }
  return result.stdout.trim();
}

describe("autonomous engineering CI routing", () => {
  it("installs the repository dependency graph before strict architecture analysis", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/autonomous-engineering.yml",
        import.meta.url,
      ),
      "utf8",
    );
    expect(workflow.indexOf("- name: Install dependencies")).toBeGreaterThan(
      workflow.indexOf("- name: Setup Node"),
    );
    expect(
      workflow.indexOf("- name: Strict changed-architecture gate"),
    ).toBeGreaterThan(workflow.indexOf("- name: Install dependencies"));
    expect(workflow).toContain(
      "WORKTREE_BASE_REF: ${{ github.event.pull_request.base.sha }}",
    );
    expect(workflow).toContain(
      "WORKTREE_HEAD_REF: ${{ github.event.pull_request.head.sha }}",
    );
  });

  it("checks the exact committed range without mistaking install churn for PR changes", () => {
    const repo = mkdtempSync(
      join(realpathSync(tmpdir()), "sanctuary-ci-ownership-"),
    );
    try {
      runGit(repo, ["init"]);
      runGit(repo, ["config", "user.email", "fixture@example.com"]);
      runGit(repo, ["config", "user.name", "Fixture"]);
      mkdirSync(join(repo, "tmp", "ne"), { recursive: true });
      writeFileSync(join(repo, "tmp", "ne", "version.txt"), "before\n");
      writeFileSync(join(repo, "tracked-cache.json"), "{}\n");
      runGit(repo, ["add", "."]);
      runGit(repo, ["commit", "-m", "base"]);
      const base = runGit(repo, ["rev-parse", "HEAD"]);

      mkdirSync(join(repo, "packages", "ai", "src"), { recursive: true });
      writeFileSync(
        join(repo, "packages", "ai", "src", "review.ts"),
        "export const reviewed = true;\n",
      );
      runGit(repo, ["add", "."]);
      runGit(repo, ["commit", "-m", "feature"]);
      const head = runGit(repo, ["rev-parse", "HEAD"]);

      writeFileSync(join(repo, "tmp", "ne", "version.txt"), "after install\n");
      rmSync(join(repo, "tracked-cache.json"));

      const report = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "../scripts/worktree-ownership-report.mjs",
              import.meta.url,
            ),
          ),
          "--changed",
          "--strict",
        ],
        {
          cwd: repo,
          encoding: "utf8",
          env: {
            ...process.env,
            WORKTREE_BASE_REF: base,
            WORKTREE_HEAD_REF: head,
            WORKTREE_OWNER_PATTERNS: "packages/ai/**",
          },
        },
      );
      expect(report.status, report.stderr || report.stdout).toBe(0);
      expect(report.stdout).toContain("1 owned, 0 unclaimed, 0 outside-lane");
      expect(report.stdout).not.toContain("tmp/ne/version.txt");
      expect(report.stdout).not.toContain("tracked-cache.json");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps one stable check while running focused gates only for foundation paths", () => {
    expect(
      routeEngineeringCi([
        "apps/portal/app/page.tsx",
        "infra/openclaw/engineering/openclaw.json",
        "packages/ai/src/engineering.ts",
        "scripts/worktree-ownership-report.mjs",
      ]),
    ).toMatchObject({
      mode: "foundation",
      relevant: true,
      relevantPaths: [
        "infra/openclaw/engineering/openclaw.json",
        "packages/ai/src/engineering.ts",
        "scripts/worktree-ownership-report.mjs",
      ],
    });
    expect(routeEngineeringCi(["apps/portal/app/page.tsx"])).toMatchObject({
      mode: "not_applicable",
      relevant: false,
      relevantPaths: [],
    });
  });

  it("rejects unsafe paths and binds pull-request diffs to exact SHAs", () => {
    expect(() => routeEngineeringCi(["../outside"])).toThrow(/unsafe/);
    let args: string[] = [];
    const paths = changedPathsForEvent(
      { pull_request: { base: { sha: baseSha }, head: { sha: headSha } } },
      (value) => {
        args = value;
        return ["packages/ai/src/engineering.ts"];
      },
    );
    expect(paths).toEqual(["packages/ai/src/engineering.ts"]);
    expect(args).toEqual([
      "diff",
      "--name-only",
      "--diff-filter=ACDMRTUXB",
      `${baseSha}...${headSha}`,
    ]);
  });
});

describe("exact-head GitHub CI evidence", () => {
  it("recognizes runner failures and differing built-in retry assertions", () => {
    expect(
      classifyFailureLog("runner has lost communication with the server"),
    ).toMatchObject({ disposition: "transient" });
    expect(
      classifyFailureLog(`Expected: "9"
Received: null
Retry #1
Expected: 11
Received: 10`),
    ).toMatchObject({
      disposition: "transient",
      reason: expect.stringContaining("different assertions"),
    });
    expect(classifyFailureLog("Expected: 9\nReceived: 10")).toMatchObject({
      disposition: "actionable",
    });
  });

  it("records passed evidence for the exact open draft pull request", () => {
    const { ci } = runtime([check("SUCCESS")]);
    const evidence = ci.inspect({
      manifest: manifest(),
      completion: completion(),
    });
    expect(evidence).toMatchObject({
      schema: "sanctuary-engineering-ci-evidence-v1",
      repository: "velt-design/sanctuary",
      classification: "passed",
      pullRequest: {
        number: 123,
        baseSha,
        headSha,
        draft: true,
      },
      requiredChecks: [
        {
          name: "Fixture CI",
          disposition: "passed",
          startedAt: "2026-08-26T00:00:00Z",
          completedAt: "2026-08-26T00:01:00Z",
        },
      ],
      evidenceHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
  });

  it("waits for missing or running checks without treating them as success", () => {
    expect(
      runtime([]).ci.inspect({
        manifest: manifest(),
        completion: completion(),
      }),
    ).toMatchObject({ classification: "pending" });
    expect(
      runtime([
        check(null as unknown as string, {
          status: "IN_PROGRESS",
          completedAt: null,
        }),
      ]).ci.inspect({ manifest: manifest(), completion: completion() }),
    ).toMatchObject({ classification: "pending" });
  });

  it("dispatches only the exact missing AI foundation workflow on its verified branch", () => {
    const setup = runtime([]);
    const task = manifest();
    task.verification.ciChecks = ["AI Foundation / Provider-neutral contracts"];
    const evidence = setup.ci.inspect({
      manifest: task,
      completion: completion(),
    });
    expect(
      setup.ci.dispatchMissing({
        manifest: task,
        completion: completion(),
        evidence,
      }),
    ).toEqual({
      workflow: "ai-foundation.yml",
      branch: task.branch,
      headSha,
    });
    expect(setup.git.calls.at(-1)).toEqual([
      "workflow",
      "run",
      "ai-foundation.yml",
      "--repo",
      "velt-design/sanctuary",
      "--ref",
      task.branch,
    ]);
    const unrelated = manifest();
    expect(
      setup.ci.dispatchMissing({
        manifest: unrelated,
        completion: completion(),
        evidence,
      }),
    ).toBeNull();
  });

  it("classifies stable failures for repair and suspected flakes for one rerun", () => {
    const actionable = runtime([check("FAILURE")]);
    expect(
      actionable.ci.inspect({
        manifest: manifest(),
        completion: completion(),
      }),
    ).toMatchObject({
      classification: "repair_required",
      requiredChecks: [{ disposition: "actionable" }],
    });

    const transient = runtime([check("FAILURE")]);
    transient.git.failedLog = "ETIMEDOUT while downloading dependency";
    const evidence = transient.ci.inspect({
      manifest: manifest(),
      completion: completion(),
    });
    expect(evidence).toMatchObject({ classification: "transient" });
    expect(transient.ci.rerunTransient(evidence)).toEqual(["456"]);
    expect(transient.git.calls.at(-1)).toEqual([
      "run",
      "rerun",
      "456",
      "--failed",
      "--repo",
      "velt-design/sanctuary",
    ]);
  });

  it("fails closed on duplicate checks or stale pull-request identity", () => {
    expect(() =>
      runtime([check("SUCCESS"), check("SUCCESS")]).ci.inspect({
        manifest: manifest(),
        completion: completion(),
      }),
    ).toThrow(/duplicate/);
    const stale = runtime([check("SUCCESS")]);
    stale.git.currentPullRequest.headRefOid = "c".repeat(40);
    expect(() =>
      stale.ci.inspect({ manifest: manifest(), completion: completion() }),
    ).toThrow(/exact open draft/);
  });

  it("returns a bounded exact diff and rechecks the revision afterwards", () => {
    const setup = runtime([check("SUCCESS")]);
    const evidence = setup.ci.inspect({
      manifest: manifest(),
      completion: completion(),
    });
    expect(setup.ci.diff(evidence)).toContain("+safe change");
    setup.git.currentPullRequest.headRefOid = "c".repeat(40);
    expect(() => setup.ci.diff(evidence)).toThrow(/changed while review/);
  });
});

describe("bounded autonomous CI watch", () => {
  it("waits without user prompts and carries each durable revision forward", async () => {
    let clock = 0;
    const requests: Value[] = [];
    const results = [
      {
        flowId: "flow-1",
        revision: 2,
        phase: "ci_pending",
        flowStatus: "waiting",
      },
      {
        flowId: "flow-1",
        revision: 3,
        phase: "ci_pending",
        flowStatus: "waiting",
      },
      {
        flowId: "flow-1",
        revision: 4,
        phase: "reviewer_ready",
        flowStatus: "running",
      },
    ];
    const result = await watchEngineeringCi({
      inspect(input) {
        requests.push(input);
        return results.shift()!;
      },
      input: { flowId: "flow-1", expectedRevision: 1 },
      now: () => clock,
      wait: async (milliseconds) => {
        clock += milliseconds;
      },
      pollIntervalMs: 30_000,
      watchWindowMs: 60_000,
    });
    expect(requests).toEqual([
      { flowId: "flow-1", expectedRevision: 1 },
      { flowId: "flow-1", expectedRevision: 2 },
      { flowId: "flow-1", expectedRevision: 3 },
    ]);
    expect(result).toMatchObject({ phase: "reviewer_ready", revision: 4 });
  });

  it("returns a durable pending checkpoint after one bounded watch window", async () => {
    let clock = 0;
    const result = await watchEngineeringCi({
      inspect: () => ({
        flowId: "flow-1",
        revision: 2,
        phase: "ci_pending",
        flowStatus: "waiting",
      }),
      input: { flowId: "flow-1", expectedRevision: 1 },
      now: () => clock,
      wait: async (milliseconds) => {
        clock += milliseconds;
      },
      pollIntervalMs: 10_000,
      watchWindowMs: 20_000,
    });
    expect(result).toMatchObject({
      phase: "ci_pending",
      watchWindowElapsed: true,
      retryAfterSeconds: 10,
    });
  });
});
