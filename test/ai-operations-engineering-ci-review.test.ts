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
import {
  ENGINEERING_CI_TOOL_TIMEOUT_MS,
  ENGINEERING_CI_WATCH_WINDOW_MS,
  watchEngineeringCi,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-ci-watch.mjs";
import {
  FOUNDATION_OWNER_PATTERNS,
  changedPathsForEvent,
  routeEngineeringCi,
  writeOutputs,
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
  workflowRuns: Value[] = [];
  workflowRunDetails = new Map<string, Value>();

  constructor(checks: Value[]) {
    this.currentPullRequest = pullRequest(checks);
  }

  safeGh = (args: string[]) => {
    this.calls.push([...args]);
    if (args[0] === "pr" && args[1] === "view") {
      return { stdout: JSON.stringify(this.currentPullRequest) };
    }
    if (args[0] === "run" && args[1] === "view") {
      if (args.includes("--json")) {
        const detail = this.workflowRunDetails.get(args[2]);
        if (!detail) throw new Error(`Unknown workflow run: ${args[2]}`);
        return { stdout: JSON.stringify(detail) };
      }
      return { stdout: this.failedLog };
    }
    if (args[0] === "run" && args[1] === "list") {
      return { stdout: JSON.stringify(this.workflowRuns) };
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
      routeKind: "foundation_owned",
      relevant: true,
      ownershipRequired: true,
      sharedImpactOnly: false,
      relevantPaths: [
        "infra/openclaw/engineering/openclaw.json",
        "packages/ai/src/engineering.ts",
        "scripts/worktree-ownership-report.mjs",
      ],
      ownedPaths: [
        "infra/openclaw/engineering/openclaw.json",
        "packages/ai/src/engineering.ts",
      ],
      sharedImpactPaths: ["scripts/worktree-ownership-report.mjs"],
    });
    expect(routeEngineeringCi(["apps/portal/app/page.tsx"])).toMatchObject({
      mode: "not_applicable",
      routeKind: "not_applicable",
      relevant: false,
      ownershipRequired: false,
      sharedImpactOnly: false,
      relevantPaths: [],
    });
  });

  it("runs AI impact checks without claiming a mixed shared-manifest PR as an AI-owned lane", () => {
    expect(
      routeEngineeringCi([
        ".github/workflows/portal-quality.yml",
        "docs/portal-production-readiness.md",
        "docs/testing-and-qa.md",
        "package.json",
        "packages/geometry/src/plan.test.ts",
        "packages/geometry/src/section.test.ts",
      ]),
    ).toMatchObject({
      mode: "foundation",
      routeKind: "shared_impact",
      relevant: true,
      ownershipRequired: false,
      sharedImpactOnly: true,
      relevantPaths: ["package.json"],
      ownedPaths: [],
      sharedImpactPaths: ["package.json"],
    });

    expect(
      routeEngineeringCi(["apps/portal/app/page.test.tsx", "vitest.config.ts"]),
    ).toMatchObject({
      routeKind: "shared_impact",
      relevant: true,
      ownershipRequired: false,
      sharedImpactOnly: true,
      relevantPaths: ["vitest.config.ts"],
    });
  });

  it("retains strict foundation ownership when a mixed PR changes AI-owned files", () => {
    expect(
      routeEngineeringCi([
        "package-lock.json",
        "package.json",
        "packages/ai/src/engineering.ts",
        "packages/geometry/src/plan.test.ts",
      ]),
    ).toMatchObject({
      routeKind: "foundation_owned",
      relevant: true,
      ownershipRequired: true,
      sharedImpactOnly: false,
      relevantPaths: [
        "package-lock.json",
        "package.json",
        "packages/ai/src/engineering.ts",
      ],
      ownedPaths: ["packages/ai/src/engineering.ts"],
      sharedImpactPaths: ["package-lock.json", "package.json"],
    });
  });

  it("keeps non-ownership strict guards on shared-impact routes", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/autonomous-engineering.yml",
        import.meta.url,
      ),
      "utf8",
    );

    expect(workflow).toContain(
      "if: steps.route.outputs.ownership_required == 'true' && github.event_name == 'pull_request'",
    );
    expect(workflow).toContain(
      "if: steps.route.outputs.shared_impact_only == 'true' && github.event_name == 'pull_request'",
    );
    const sharedGateStart = workflow.indexOf(
      "- name: Strict shared-impact architecture gates",
    );
    const sharedGateEnd = workflow.indexOf(
      "- name: AI operations contracts",
      sharedGateStart,
    );
    const sharedGate = workflow.slice(sharedGateStart, sharedGateEnd);
    for (const command of [
      "npm run files:changed:strict",
      "npm run dead-code:changed:strict",
      "npm run root:compat:changed:strict",
      "npm run browser:supabase:changed:strict",
      "npm run service-role:changed:strict",
    ]) {
      expect(sharedGate).toContain(command);
    }
    expect(sharedGate).not.toContain("worktree:changed:strict");
    expect(sharedGate).not.toContain("architecture:changed:strict");
    expect(workflow).toContain("run: npm run architecture:changed:strict");
    expect(
      workflow.match(/if: steps\.route\.outputs\.relevant == 'true'/g),
    ).toHaveLength(6);
  });

  it("writes explicit workflow outputs for shared-impact routing", () => {
    const dir = mkdtempSync(
      join(realpathSync(tmpdir()), "sanctuary-ci-route-output-"),
    );
    try {
      const outputPath = join(dir, "github-output.txt");
      writeFileSync(outputPath, "");
      writeOutputs(
        routeEngineeringCi(["apps/portal/app/page.tsx", "package.json"]),
        outputPath,
      );
      expect(readFileSync(outputPath, "utf8")).toBe(
        [
          "mode=foundation",
          "route_kind=shared_impact",
          "relevant=true",
          "ownership_required=false",
          "shared_impact_only=true",
          `owner_patterns=${FOUNDATION_OWNER_PATTERNS.join(",")}`,
          "changed_count=2",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
      "--no-renames",
      "--name-only",
      "--diff-filter=ACDMRTUXB",
      `${baseSha}...${headSha}`,
    ]);
  });

  it("treats a rename out of an AI-owned path as strict ownership on every event route", () => {
    const repo = mkdtempSync(
      join(realpathSync(tmpdir()), "sanctuary-ci-rename-route-"),
    );
    try {
      runGit(repo, ["init"]);
      runGit(repo, ["config", "user.email", "fixture@example.com"]);
      runGit(repo, ["config", "user.name", "Fixture"]);
      mkdirSync(join(repo, "packages", "ai", "src"), { recursive: true });
      writeFileSync(
        join(repo, "packages", "ai", "src", "contract.ts"),
        "export const contract = true;\n",
      );
      runGit(repo, ["add", "."]);
      runGit(repo, ["commit", "-m", "base"]);
      const base = runGit(repo, ["rev-parse", "HEAD"]);

      mkdirSync(join(repo, "packages", "geometry", "src"), {
        recursive: true,
      });
      runGit(repo, [
        "mv",
        "packages/ai/src/contract.ts",
        "packages/geometry/src/contract.ts",
      ]);
      runGit(repo, ["commit", "-m", "rename out"]);
      const head = runGit(repo, ["rev-parse", "HEAD"]);
      const git = (args: string[]) =>
        runGit(repo, args).split(/\r?\n/).filter(Boolean);

      for (const event of [
        { pull_request: { base: { sha: base }, head: { sha: head } } },
        { before: base, after: head },
        {},
      ]) {
        const changedPaths = changedPathsForEvent(event, git);
        expect(changedPaths).toEqual([
          "packages/ai/src/contract.ts",
          "packages/geometry/src/contract.ts",
        ]);
        expect(routeEngineeringCi(changedPaths)).toMatchObject({
          routeKind: "foundation_owned",
          ownershipRequired: true,
          ownedPaths: ["packages/ai/src/contract.ts"],
        });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
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
        check("", {
          status: "IN_PROGRESS",
          completedAt: "0001-01-01T00:00:00Z",
        }),
      ]).ci.inspect({ manifest: manifest(), completion: completion() }),
    ).toMatchObject({
      classification: "pending",
      requiredChecks: [{
        status: "IN_PROGRESS",
        conclusion: null,
        disposition: "pending",
      }],
    });
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

  it("adopts the exact required job from one manually dispatched workflow run", () => {
    const setup = runtime([]);
    const task = manifest();
    task.verification.ciChecks = ["AI Foundation / Provider-neutral contracts"];
    const runId = 789;
    const runUrl = "https://github.com/velt-design/sanctuary/actions/runs/789";
    setup.git.workflowRuns = [
      {
        databaseId: runId,
        status: "completed",
        conclusion: "success",
        headSha,
        headBranch: task.branch,
        event: "workflow_dispatch",
        url: runUrl,
        createdAt: "2026-08-26T00:00:00Z",
        updatedAt: "2026-08-26T00:01:00Z",
        name: "AI Foundation",
        workflowName: "AI Foundation",
      },
    ];
    setup.git.workflowRunDetails.set(String(runId), {
      ...setup.git.workflowRuns[0],
      jobs: [
        {
          databaseId: 456,
          name: "Provider-neutral contracts",
          status: "completed",
          conclusion: "success",
          startedAt: "2026-08-26T00:00:05Z",
          completedAt: "2026-08-26T00:00:55Z",
          url: `${runUrl}/job/456`,
        },
      ],
    });

    expect(
      setup.ci.inspect({ manifest: task, completion: completion() }),
    ).toMatchObject({
      classification: "passed",
      requiredChecks: [
        {
          name: "AI Foundation / Provider-neutral contracts",
          kind: "workflow_job",
          disposition: "passed",
          runId: "789",
          url: `${runUrl}/job/456`,
        },
      ],
    });
  });

  it("fails closed when multiple dispatched runs claim the same exact head", () => {
    const setup = runtime([]);
    const task = manifest();
    task.verification.ciChecks = ["AI Foundation / Provider-neutral contracts"];
    setup.git.workflowRuns = [789, 790].map((databaseId) => ({
      databaseId,
      status: "completed",
      conclusion: "success",
      headSha,
      headBranch: task.branch,
      event: "workflow_dispatch",
      url: `https://github.com/velt-design/sanctuary/actions/runs/${databaseId}`,
      workflowName: "AI Foundation",
    }));

    expect(
      setup.ci.inspect({ manifest: task, completion: completion() }),
    ).toMatchObject({
      classification: "blocked",
      requiredChecks: [
        {
          kind: "workflow_run",
          disposition: "blocked",
        },
      ],
    });
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
  it("finishes its watch window before the fixed OpenClaw tool watchdog", () => {
    expect(ENGINEERING_CI_WATCH_WINDOW_MS).toBe(120_000);
    expect(ENGINEERING_CI_TOOL_TIMEOUT_MS).toBe(180_000);
    expect(
      ENGINEERING_CI_TOOL_TIMEOUT_MS - ENGINEERING_CI_WATCH_WINDOW_MS,
    ).toBe(60_000);
  });

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
