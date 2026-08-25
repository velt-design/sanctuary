// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  ENGINEERING_TASK_COMPLETION_SCHEMA_V1,
  ENGINEERING_TASK_MANIFEST_SCHEMA_V1,
  type EngineeringTaskCompletionV1,
  type EngineeringTaskManifestV1,
} from "./engineering";

const BASE_SHA = "0bace9e852becf0d5c8d4a49bb2f7f759f0bed75";
const HEAD_SHA = "850dbac7c014cdd4da398ce885e64662ed223052";
const MANIFEST_HASH = `sha256:${"a".repeat(64)}`;

const manifest: EngineeringTaskManifestV1 = {
  schema: "sanctuary-engineering-task-v1",
  taskId: "eng_20260826_foundation_contracts",
  goalId: "goal_20260826_autonomous_engineering",
  objective:
    "Add the machine-checked engineering task and completion contracts.",
  requestedBy: "Jordan / Sanctuary Pergolas",
  base: { ref: "main", sha: BASE_SHA },
  branch: "ai/autonomy-foundation-contracts",
  risk: "medium",
  ownerLane: "ai-engineering-contracts",
  roles: {
    supervisor: "engineering_lead",
    worker: "coding_worker",
    reviewer: "code_reviewer",
  },
  readFirst: ["AGENTS.md", "docs/ai/sanctuary-ai-master-plan.md"],
  ownedPaths: ["packages/ai/**", "docs/ai/**"],
  excludedPaths: ["apps/portal/**", "supabase/**"],
  dependencies: [],
  acceptanceCriteria: [
    "Both contracts reject unknown fields and unsafe terminal states.",
  ],
  verification: {
    focusedCommands: [
      "npx vitest run packages/ai/src/engineering.test.ts",
      "npx tsc -p packages/ai/tsconfig.typecheck.json --noEmit --incremental false",
    ],
    ciChecks: ["AI Foundation / Provider-neutral contracts"],
    visualEvidence: { required: false, scenarios: [] },
  },
  limits: {
    maxWorkers: 1,
    maxAttempts: 3,
    workerTimeoutMinutes: 60,
    maxCostCents: 5_000,
  },
  approvals: {
    planning: "approved",
    merge: "human_required",
    scopeExpansion: "human_required",
    production: "prohibited",
  },
  outputs: { draftPullRequest: true, completionReport: true },
  stopConditions: [
    "A source-of-truth owner is unclear.",
    "Work requires an excluded path.",
  ],
};

const completion: EngineeringTaskCompletionV1 = {
  schema: "sanctuary-engineering-completion-v1",
  taskId: manifest.taskId,
  manifestHash: MANIFEST_HASH,
  outcome: "succeeded",
  branch: manifest.branch,
  baseSha: BASE_SHA,
  headSha: HEAD_SHA,
  pullRequest: {
    number: 73,
    url: "https://github.com/velt-design/sanctuary/pull/73",
    draft: true,
  },
  changedPaths: ["packages/ai/src/engineering.ts"],
  acceptanceResults: [
    {
      criterion: manifest.acceptanceCriteria[0],
      status: "passed",
      evidence: "Focused contract tests passed.",
    },
  ],
  verificationResults: [
    {
      name: "Engineering contract tests",
      command: manifest.verification.focusedCommands[0],
      status: "passed",
      summary: "All focused tests passed.",
    },
  ],
  ciChecks: [
    {
      name: manifest.verification.ciChecks[0],
      status: "pending",
      url: null,
    },
  ],
  worker: {
    agent: "sanctuary-coding-worker",
    model: "openai/gpt-5.6-sol",
    sessionIds: ["worker-session-1"],
    attempts: 1,
    costCents: 0,
    startedAt: "2026-08-26T00:00:00.000Z",
    completedAt: "2026-08-26T00:05:00.000Z",
  },
  safety: {
    worktreeClean: true,
    branchPushed: true,
    merged: false,
    productionEffects: false,
    secretScan: "passed",
  },
  limitations: ["CI remains pending at draft creation time."],
  nextAction: "Human review and merge after required checks pass.",
};

describe("engineering task manifest contract", () => {
  it("accepts the canonical manifest without changing its shape", () => {
    expect(ENGINEERING_TASK_MANIFEST_SCHEMA_V1.safeParse(manifest)).toEqual({
      success: true,
      data: manifest,
    });
  });

  it.each([
    [
      "unknown fields",
      { ...manifest, prompt: "hidden standing instruction" },
      "$.prompt",
    ],
    [
      "future schemas",
      { ...manifest, schema: "sanctuary-engineering-task-v2" },
      "$.schema",
    ],
    ["direct main work", { ...manifest, branch: "main" }, "$.branch"],
    [
      "self dependencies",
      { ...manifest, dependencies: [manifest.taskId] },
      "$.dependencies",
    ],
    [
      "absolute owned paths",
      {
        ...manifest,
        ownedPaths: ["/Users/sanctuary-runner/workspaces/sanctuary"],
      },
      "$.ownedPaths[0]",
    ],
    [
      "missing visual scenarios",
      {
        ...manifest,
        verification: {
          ...manifest.verification,
          visualEvidence: { required: true, scenarios: [] },
        },
      },
      "$.verification.visualEvidence.scenarios",
    ],
    [
      "automatic merge authority",
      { ...manifest, approvals: { ...manifest.approvals, merge: "automatic" } },
      "$.approvals.merge",
    ],
  ])("rejects %s", (_name, value, expectedPath) => {
    const result = ENGINEERING_TASK_MANIFEST_SCHEMA_V1.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.issues.map((issue) => issue.path)).toContain(expectedPath);
  });
});

describe("engineering completion contract", () => {
  it("accepts a successful draft-PR handoff without changing its shape", () => {
    expect(ENGINEERING_TASK_COMPLETION_SCHEMA_V1.safeParse(completion)).toEqual(
      {
        success: true,
        data: completion,
      },
    );
  });

  it.each([
    [
      "a non-draft pull request",
      {
        ...completion,
        pullRequest: { ...completion.pullRequest!, draft: false },
      },
      "$.pullRequest",
    ],
    [
      "a failed acceptance criterion reported as success",
      {
        ...completion,
        acceptanceResults: [
          { ...completion.acceptanceResults[0], status: "failed" },
        ],
      },
      "$.acceptanceResults[0].status",
    ],
    [
      "an unpushed successful branch",
      { ...completion, safety: { ...completion.safety, branchPushed: false } },
      "$.safety",
    ],
    [
      "an autonomous merge",
      { ...completion, safety: { ...completion.safety, merged: true } },
      "$.safety.merged",
    ],
    [
      "a production effect",
      {
        ...completion,
        safety: { ...completion.safety, productionEffects: true },
      },
      "$.safety.productionEffects",
    ],
    [
      "reversed worker timestamps",
      {
        ...completion,
        worker: {
          ...completion.worker,
          completedAt: "2026-08-25T23:59:59.000Z",
        },
      },
      "$.worker.completedAt",
    ],
  ])("rejects %s", (_name, value, expectedPath) => {
    const result = ENGINEERING_TASK_COMPLETION_SCHEMA_V1.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.issues.map((issue) => issue.path)).toContain(expectedPath);
  });

  it("allows a blocked handoff without a pull request or head commit", () => {
    const blocked = {
      ...completion,
      outcome: "blocked",
      headSha: null,
      pullRequest: null,
      acceptanceResults: [
        {
          ...completion.acceptanceResults[0],
          status: "not_run",
          evidence: "The owner boundary requires clarification.",
        },
      ],
      safety: {
        ...completion.safety,
        worktreeClean: false,
        branchPushed: false,
      },
      nextAction: "Request owner clarification.",
    };
    expect(
      ENGINEERING_TASK_COMPLETION_SCHEMA_V1.safeParse(blocked).success,
    ).toBe(true);
  });
});
