// @vitest-environment node

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createEngineeringSupervisionController } from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-runtime.mjs";
import {
  REVIEW_DIFF_CHUNK_CHARACTERS,
  REVIEW_DISPATCH_MAX_CHARACTERS,
  buildLegacyBoundedReviewPrompt,
  buildLegacyChunkedReviewPrompt,
  buildLegacyReviewPrompt,
  buildReviewDispatch,
  buildReviewPrompt,
  readReviewDiffChunk,
} from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/review-runtime.mjs";
import { ENGINEERING_TASK_REVIEW_SCHEMA_V1 } from "../packages/ai/src/index";

type Value = Record<string, any>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function hash(value: unknown) {
  return `sha256:${createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex")}`;
}

function textHash(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

class Flows {
  records = new Map<string, Value>();

  createManaged(input: Value) {
    const flow = {
      ...input,
      flowId: "flow-review-loop",
      syncMode: "managed",
      revision: 0,
      waitJson: undefined,
      endedAt: undefined,
    };
    this.records.set(flow.flowId, clone(flow));
    return clone(flow);
  }

  get = (flowId: string) => this.records.get(flowId);
  list = () => [...this.records.values()];

  mutate(input: Value, patch: Value) {
    const current = this.records.get(input.flowId);
    if (!current) return { applied: false, code: "not_found" };
    if (current.revision !== input.expectedRevision) {
      return { applied: false, code: "revision_conflict", current };
    }
    const flow = {
      ...current,
      ...patch,
      revision: current.revision + 1,
      updatedAt: input.updatedAt,
    };
    this.records.set(flow.flowId, clone(flow));
    return { applied: true, flow: clone(flow) };
  }

  setWaiting = (input: Value) =>
    this.mutate(input, {
      status:
        input.blockedTaskId || input.blockedSummary ? "blocked" : "waiting",
      currentStep: input.currentStep,
      stateJson: input.stateJson,
      waitJson: input.waitJson,
      blockedTaskId: input.blockedTaskId,
      blockedSummary: input.blockedSummary,
      endedAt: undefined,
    });

  resume = (input: Value) =>
    this.mutate(input, {
      status: input.status ?? "queued",
      currentStep: input.currentStep,
      stateJson: input.stateJson,
      waitJson: undefined,
      blockedTaskId: undefined,
      blockedSummary: undefined,
      endedAt: undefined,
    });

  finish = (input: Value) =>
    this.mutate(input, {
      status: "succeeded",
      currentStep: input.currentStep,
      stateJson: input.stateJson,
      waitJson: undefined,
      endedAt: input.endedAt,
    });

  fail = (input: Value) =>
    this.mutate(input, {
      status: "failed",
      stateJson: input.stateJson,
      waitJson: undefined,
      blockedTaskId: input.blockedTaskId,
      blockedSummary: input.blockedSummary,
      endedAt: input.endedAt,
    });
}

class Tasks {
  sessionKey = "agent:sanctuary-engineering-supervisor:test";
  records = new Map<string, Value>();

  add(input: Value) {
    const agentId = input.agentId ?? "sanctuary-coding-worker";
    const number = this.records.size + 1;
    const task = {
      id: `native-${number}`,
      runtime: "subagent",
      status: "running",
      agentId,
      sessionKey: this.sessionKey,
      childSessionKey: `agent:${agentId}:subagent:${number}`,
      ...input,
    };
    this.records.set(task.id, task);
    return task;
  }

  resolve = (token: string) =>
    this.records.get(token) ??
    [...this.records.values()].find((task) => task.runId === token);
  get = (taskId: string) => this.records.get(taskId);
  list = () => [...this.records.values()];
  cancel = async () => ({ cancelled: false, reason: "not expected" });
}

function taskManifest(maxAttempts = 2, ciCheckName = "Fixture CI") {
  return {
    schema: "sanctuary-engineering-task-v1",
    taskId: "eng_20260826_review_loop",
    goalId: "goal_20260826_autonomous_engineering",
    objective: "Prove the exact-head CI and independent review loop.",
    requestedBy: "Test operator",
    base: { ref: "main", sha: "a".repeat(40) },
    branch: "ai/test-review-loop",
    risk: "low",
    ownerLane: "test-review-loop",
    roles: {
      supervisor: "engineering_lead",
      worker: "coding_worker",
      reviewer: "code_reviewer",
    },
    readFirst: ["AGENTS.md"],
    ownedPaths: ["docs/**"],
    excludedPaths: ["supabase/**"],
    dependencies: [],
    acceptanceCriteria: [
      "The exact revision passes CI and independent review.",
    ],
    verification: {
      focusedCommands: ["npm test"],
      ciChecks: [ciCheckName],
      visualEvidence: { required: false, scenarios: [] },
    },
    limits: {
      maxWorkers: 1,
      maxAttempts,
      workerTimeoutMinutes: 60,
      maxCostCents: 900,
    },
    approvals: {
      planning: "approved",
      merge: "human_required",
      scopeExpansion: "human_required",
      production: "prohibited",
    },
    outputs: { draftPullRequest: true, completionReport: true },
    stopConditions: ["Identity drift."],
  };
}

function ciEvidence(
  manifest: Value,
  completion: Value,
  classification = "passed",
  version = 1,
) {
  const disposition = {
    passed: "passed",
    pending: "pending",
    transient: "transient",
    repair_required: "actionable",
    blocked: "blocked",
  }[classification];
  const evidence = {
    schema: "sanctuary-engineering-ci-evidence-v1",
    repository: "velt-design/sanctuary",
    pullRequest: {
      number: completion.pullRequest.number,
      url: completion.pullRequest.url,
      baseRef: manifest.base.ref,
      baseSha: manifest.base.sha,
      headRef: manifest.branch,
      headSha: completion.headSha,
      draft: true,
    },
    requiredChecks: [
      {
        name: manifest.verification.ciChecks[0],
        kind: "check_run",
        status: classification === "pending" ? "IN_PROGRESS" : "COMPLETED",
        conclusion: classification === "pending" ? null : "FAILURE",
        url: `https://github.com/velt-design/sanctuary/actions/runs/${version}/job/1`,
        workflowName: "Fixture CI",
        runId: String(version),
        startedAt: `2026-08-26T00:0${version}:00Z`,
        completedAt:
          classification === "pending" ? null : `2026-08-26T00:0${version}:30Z`,
        disposition,
        reason:
          classification === "repair_required"
            ? "A stable assertion requires a same-lane repair."
            : `Fixture ${classification}.`,
      },
    ],
    classification,
  };
  if (classification === "passed") {
    evidence.requiredChecks[0].conclusion = "SUCCESS";
  }
  return { ...evidence, evidenceHash: hash(evidence) };
}

function missingCiEvidence(manifest: Value, completion: Value) {
  const evidence = ciEvidence(manifest, completion, "pending");
  evidence.requiredChecks = [
    {
      name: manifest.verification.ciChecks[0],
      kind: "missing",
      status: null,
      conclusion: null,
      url: null,
      workflowName: null,
      runId: null,
      startedAt: null,
      completedAt: null,
      disposition: "pending",
      reason: "The required check has not appeared for this exact head.",
    },
  ];
  const { evidenceHash: _evidenceHash, ...canonical } = evidence;
  return { ...canonical, evidenceHash: hash(canonical) };
}

function workflowJobCiEvidence(manifest: Value, completion: Value) {
  const evidence = ciEvidence(manifest, completion);
  evidence.requiredChecks[0].kind = "workflow_job";
  const { evidenceHash: _evidenceHash, ...canonical } = evidence;
  return { ...canonical, evidenceHash: hash(canonical) };
}

class CiRuntime {
  queue: Value[] = [];
  dispatches: Value[] = [];
  inspections = 0;
  reruns: string[][] = [];

  inspect = ({ manifest, completion }: Value) => {
    const item =
      this.queue[Math.min(this.inspections, this.queue.length - 1)] ??
      ciEvidence(manifest, completion);
    this.inspections += 1;
    return clone(item);
  };

  diff = () => "diff --git a/docs/result.md b/docs/result.md\n+reviewed\n";

  dispatchMissing = (input: Value) => {
    if (
      input.evidence.requiredChecks.length !== 1 ||
      input.evidence.requiredChecks[0].name !==
        "AI Foundation / Provider-neutral contracts"
    ) {
      return null;
    }
    const result = {
      workflow: "ai-foundation.yml",
      branch: input.manifest.branch,
      headSha: input.completion.headSha,
    };
    this.dispatches.push(result);
    return result;
  };

  rerunTransient = (evidence: Value) => {
    const ids = evidence.requiredChecks.map((entry: Value) => entry.runId);
    this.reruns.push(ids);
    return ids;
  };
}

function fixture(maxAttempts = 2, ciCheckName = "Fixture CI") {
  const flows = new Flows();
  const tasks = new Tasks();
  const ci = new CiRuntime();
  const lanes = new Map<string, Value>();
  const manifest = taskManifest(maxAttempts, ciCheckName);
  let clock = 1_700_000_000_000;
  const manifestHash = hash(manifest);
  const contractAdapter = {
    resolve(value: Value) {
      return { manifest: clone(value), manifestHash: hash(value) };
    },
    validateCompletion: clone,
    validateReview(value: Value) {
      return ENGINEERING_TASK_REVIEW_SCHEMA_V1.parse(value);
    },
  };
  const laneRuntime = {
    provision(value: Value) {
      let lane = lanes.get(manifestHash);
      if (!lane) {
        lane = {
          taskId: value.taskId,
          manifestHash,
          state: "active",
          branch: value.branch,
          baseSha: value.base.sha,
          headSha: value.base.sha,
          worktreePath: `/runtime/${value.taskId}/repo`,
          clean: true,
          changedPaths: [],
          pullRequest: null,
          workerPrompt: "Implement the exact fixture task.",
        };
        lanes.set(manifestHash, lane);
      }
      return clone(lane);
    },
    status(taskId: string, identity: string) {
      const lane = lanes.get(identity);
      if (!lane || lane.taskId !== taskId) throw new Error("missing lane");
      return clone(lane);
    },
  };
  const controller = () =>
    createEngineeringSupervisionController({
      flowRuntime: flows,
      taskRuns: tasks,
      ciRuntime: ci,
      contractAdapter,
      laneRuntime,
      repoRoot: "/repo",
      stateDir: "/state",
      runtimeTimeoutSeconds: 3_600,
      runtimeConfig: {
        agents: { defaults: { subagents: { runTimeoutSeconds: 3_600 } } },
      },
      now: () => clock,
    });
  return {
    manifest,
    manifestHash,
    flows,
    tasks,
    ci,
    lanes,
    controller,
    advance: (milliseconds: number) => {
      clock += milliseconds;
    },
  };
}

async function reachCi(setup: ReturnType<typeof fixture>) {
  setup.controller().enqueue(setup.manifest);
  const dispatch = setup.controller().claim();
  const worker = setup.tasks.add({
    runId: "run-worker-1",
    label: null,
    title: dispatch.workerPrompt,
    createdAt: dispatch.attemptStartedAt,
  });
  const attached = setup.controller().attach({
    flowId: dispatch.flowId,
    expectedRevision: dispatch.expectedRevision,
    runId: worker.runId,
  });
  worker.status = "succeeded";
  worker.endedAt = 1_700_000_010_000;
  const report = {
    schema: "sanctuary-engineering-completion-v1",
    taskId: setup.manifest.taskId,
    manifestHash: dispatch.manifestHash,
    outcome: "succeeded",
    branch: setup.manifest.branch,
    baseSha: setup.manifest.base.sha,
    headSha: "b".repeat(40),
    pullRequest: {
      number: 123,
      url: "https://github.com/velt-design/sanctuary/pull/123",
      draft: true,
    },
    changedPaths: ["docs/result.md"],
    acceptanceResults: [
      {
        criterion: setup.manifest.acceptanceCriteria[0],
        status: "passed",
        evidence: "Worker fixture passed.",
      },
    ],
    verificationResults: [
      {
        name: "fixture",
        command: "npm test",
        status: "passed",
        summary: "Passed.",
      },
    ],
    ciChecks: [
      {
        name: setup.manifest.verification.ciChecks[0],
        status: "pending",
        url: null,
      },
    ],
    worker: {
      agent: "sanctuary-coding-worker",
      model: "openai/gpt-5.6-sol",
      sessionIds: ["controller_bound"],
      attempts: 1,
      costCents: 100,
      startedAt: "controller_bound",
      completedAt: "controller_bound",
    },
    safety: {
      worktreeClean: true,
      branchPushed: true,
      merged: false,
      productionEffects: false,
      secretScan: "passed",
    },
    limitations: ["CI and review remain."],
    nextAction: "Run exact-head CI.",
  };
  const lane = setup.lanes.get(dispatch.manifestHash)!;
  Object.assign(lane, {
    state: "published",
    headSha: report.headSha,
    changedPaths: report.changedPaths,
    pullRequest: report.pullRequest,
  });
  const ciPending = await setup.controller().reconcile({
    flowId: dispatch.flowId,
    expectedRevision: attached.revision,
    completion: report,
  });
  return { dispatch, worker, report, ciPending };
}

function attachReviewer(setup: ReturnType<typeof fixture>, dispatch: Value) {
  const reviewer = setup.tasks.add({
    runId: "run-reviewer-1",
    agentId: dispatch.reviewerAgentId,
    label: null,
    title: dispatch.reviewPrompt,
    createdAt: dispatch.reviewStartedAt,
  });
  const attached = setup.controller().attachReview({
    flowId: dispatch.flowId,
    expectedRevision: dispatch.expectedRevision,
    runId: reviewer.runId,
  });
  return { reviewer, attached };
}

function reviewReport(
  setup: ReturnType<typeof fixture>,
  dispatch: Value,
  verdict = "approved",
) {
  const blocking = verdict === "changes_requested";
  return {
    schema: "sanctuary-engineering-review-v1",
    taskId: setup.manifest.taskId,
    manifestHash: setup.manifestHash,
    verdict,
    branch: setup.manifest.branch,
    baseSha: setup.manifest.base.sha,
    headSha: "b".repeat(40),
    pullRequest: {
      number: 123,
      url: "https://github.com/velt-design/sanctuary/pull/123",
    },
    ciEvidenceHash: dispatch.ciEvidenceHash,
    acceptanceResults: [
      {
        criterion: setup.manifest.acceptanceCriteria[0],
        status: blocking ? "failed" : "passed",
        evidence: blocking ? "A defect remains." : "Exact evidence passed.",
      },
    ],
    findings: blocking
      ? [
          {
            id: "review-1",
            severity: "blocking",
            summary: "Repair the fixture defect.",
            evidence: "The exact diff contains the defect.",
            path: "docs/result.md",
            line: 1,
          },
        ]
      : [],
    reviewer: {
      agent: "sanctuary-code-reviewer",
      model: "openai/gpt-5.6-sol",
      sessionId: "controller_bound",
      costCents: 25,
      startedAt: "controller_bound",
      completedAt: "controller_bound",
    },
    safety: { readOnly: true, merged: false, productionEffects: false },
    nextAction: blocking
      ? "Repair the fixture defect."
      : "Human review and merge.",
  };
}

describe("durable exact-head CI and independent review loop", () => {
  it("serves the complete exact review diff in bounded hash-verified chunks", () => {
    const diff = `${"x".repeat(REVIEW_DIFF_CHUNK_CHARACTERS)}y`;
    const input = {
      flowId: "flow-review-loop",
      pullRequestNumber: 123,
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      diffHash: textHash(diff),
      offset: 0,
    };
    const ciRuntime = { diff: () => diff };
    const first = readReviewDiffChunk({ ciRuntime, input });
    expect(first).toMatchObject({
      offset: 0,
      nextOffset: REVIEW_DIFF_CHUNK_CHARACTERS,
      complete: false,
      totalCharacters: diff.length,
    });
    expect(first.content).toHaveLength(REVIEW_DIFF_CHUNK_CHARACTERS);
    expect(
      readReviewDiffChunk({
        ciRuntime,
        input: { ...input, offset: first.nextOffset },
      }),
    ).toMatchObject({ content: "y", nextOffset: null, complete: true });
    expect(() =>
      readReviewDiffChunk({
        ciRuntime,
        input: { ...input, diffHash: `sha256:${"0".repeat(64)}` },
      }),
    ).toThrow(/no longer matches/);

    const unicodeDiff = `${"x".repeat(REVIEW_DIFF_CHUNK_CHARACTERS - 1)}😀y`;
    const unicodeFirst = readReviewDiffChunk({
      ciRuntime: { diff: () => unicodeDiff },
      input: { ...input, diffHash: textHash(unicodeDiff) },
    });
    expect(unicodeFirst.content.endsWith("x")).toBe(true);
    expect(unicodeFirst.content).not.toContain("\ud83d");
    expect(unicodeFirst.nextOffset).toBe(REVIEW_DIFF_CHUNK_CHARACTERS - 1);
  });

  it("accepts an exact dispatched workflow job as durable CI evidence", async () => {
    const setup = fixture(2, "AI Foundation / Provider-neutral contracts");
    const reached = await reachCi(setup);
    setup.ci.queue = [workflowJobCiEvidence(setup.manifest, reached.report)];

    expect(
      setup.controller().inspectCi({
        flowId: reached.ciPending.flowId,
        expectedRevision: reached.ciPending.revision,
      }),
    ).toMatchObject({
      reviewReady: true,
      reviewerAgentId: "sanctuary-code-reviewer",
    });
    expect(
      setup.controller().status(setup.manifest.taskId, setup.manifestHash),
    ).toMatchObject({ phase: "reviewer_ready", ciClassification: "passed" });
  });

  it("recovers legacy blank pending CI evidence and refreshes it", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const legacy = ciEvidence(setup.manifest, reached.report, "pending");
    legacy.requiredChecks[0].conclusion = "";
    const { evidenceHash: _evidenceHash, ...canonical } = legacy;
    const stored = setup.flows.records.get(reached.ciPending.flowId)!;
    stored.stateJson.ci.evidence = {
      ...canonical,
      evidenceHash: hash(canonical),
    };
    setup.ci.queue = [ciEvidence(setup.manifest, reached.report)];

    const recovered = await setup.controller().recover();

    expect(recovered).toMatchObject({ reviewReady: true });
    expect(
      setup.flows.records.get(reached.ciPending.flowId)!.stateJson.ci.evidence
        .requiredChecks[0],
    ).toMatchObject({
      conclusion: "SUCCESS",
      disposition: "passed",
    });
  });

  it("cannot finish until exact CI and the named reviewer both approve", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const { ciPending } = reached;
    expect(ciPending).toMatchObject({
      phase: "ci_pending",
      flowStatus: "waiting",
      reviewStatus: null,
    });

    const reviewDispatch = setup.controller().inspectCi({
      flowId: ciPending.flowId,
      expectedRevision: ciPending.revision,
    });
    expect(reviewDispatch).toMatchObject({
      reviewReady: true,
      reviewerAgentId: "sanctuary-code-reviewer",
    });
    expect(
      setup.controller().status(setup.manifest.taskId, setup.manifestHash),
    ).toMatchObject({
      phase: "reviewer_ready",
      flowStatus: "running",
    });

    const { reviewer, attached } = attachReviewer(setup, reviewDispatch);
    reviewer.status = "succeeded";
    reviewer.endedAt = 1_700_000_020_000;
    const finished = await setup.controller().reconcileReview({
      flowId: reviewDispatch.flowId,
      expectedRevision: attached.revision,
      report: reviewReport(setup, reviewDispatch),
    });
    expect(finished).toMatchObject({
      phase: "succeeded",
      flowStatus: "succeeded",
      ciClassification: "passed",
      reviewVerdict: "approved",
      cumulativeCostCents: 125,
    });
    const stored = setup.flows.records.get(finished.flowId)!.stateJson;
    expect(stored.completion.worker).toMatchObject({
      sessionIds: [reached.worker.childSessionKey],
      startedAt: new Date(reached.worker.createdAt).toISOString(),
      completedAt: new Date(reached.worker.endedAt).toISOString(),
    });
    expect(stored.review.report.reviewer).toMatchObject({
      sessionId: reviewer.childSessionKey,
      startedAt: new Date(reviewer.createdAt).toISOString(),
      completedAt: new Date(reviewer.endedAt).toISOString(),
    });
  });

  it("routes stable CI failure into one bounded same-lane repair", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    setup.ci.queue = [
      ciEvidence(setup.manifest, reached.report, "repair_required"),
    ];
    const repair = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    expect(repair).toMatchObject({
      repairReady: true,
      retryReady: true,
      phase: "retry_ready",
      repairKind: "ci_failure",
    });
    const second = await setup.controller().recover();
    expect(second).toMatchObject({
      attempt: 2,
      worktreePath: reached.dispatch.worktreePath,
    });
    expect(second.workerPrompt).toContain("Required repair evidence");
    expect(second.workerPrompt).toContain("Fixture CI");
  });

  it("dispatches a missing exact-head foundation workflow only once", async () => {
    const setup = fixture(2, "AI Foundation / Provider-neutral contracts");
    const reached = await reachCi(setup);
    const missing = missingCiEvidence(setup.manifest, reached.report);
    setup.ci.queue = [missing, missing];
    delete setup.flows.records.get(reached.ciPending.flowId)!.stateJson.ci
      .missingDispatches;

    const dispatched = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    expect(dispatched).toMatchObject({
      dispatchRequested: true,
      ciMissingDispatches: 1,
      phase: "ci_pending",
    });
    expect(setup.ci.dispatches).toEqual([
      {
        workflow: "ai-foundation.yml",
        branch: setup.manifest.branch,
        headSha: reached.report.headSha,
      },
    ]);

    const unchanged = setup.controller().inspectCi({
      flowId: dispatched.flowId,
      expectedRevision: dispatched.revision,
    });
    expect(unchanged).toMatchObject({
      unchanged: true,
      ciMissingDispatches: 1,
      phase: "ci_pending",
    });
    expect(setup.ci.dispatches).toHaveLength(1);
  });

  it("allows one transient rerun, waits for GitHub to update, then stops a second failure", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const first = ciEvidence(setup.manifest, reached.report, "transient", 1);
    const second = ciEvidence(setup.manifest, reached.report, "transient", 2);
    setup.ci.queue = [first, first, second];
    const rerun = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    expect(rerun).toMatchObject({ rerunRequested: true, ciTransientReruns: 1 });
    expect(setup.ci.reruns).toEqual([["1"]]);
    const unchanged = setup.controller().inspectCi({
      flowId: rerun.flowId,
      expectedRevision: rerun.revision,
    });
    expect(unchanged).toMatchObject({ unchanged: true, phase: "ci_pending" });
    const blocked = setup.controller().inspectCi({
      flowId: unchanged.flowId,
      expectedRevision: unchanged.revision,
    });
    expect(blocked).toMatchObject({
      phase: "blocked",
      flowStatus: "blocked",
      ciTransientReruns: 1,
    });
  });

  it("turns blocking reviewer findings into a same-lane repair", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const { reviewer, attached } = attachReviewer(setup, reviewDispatch);
    reviewer.status = "succeeded";
    reviewer.endedAt = 1_700_000_020_000;
    const repair = await setup.controller().reconcileReview({
      flowId: reviewDispatch.flowId,
      expectedRevision: attached.revision,
      report: reviewReport(setup, reviewDispatch, "changes_requested"),
    });
    expect(repair).toMatchObject({
      phase: "retry_ready",
      retryReady: true,
      repairKind: "review_changes",
      cumulativeCostCents: 125,
    });
    const second = await setup.controller().recover();
    expect(second.workerPrompt).toContain(
      "review-1: Repair the fixture defect",
    );
  });

  it("rejects wrong reviewer identity, stale revisions and mismatched reports", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    expect(reviewDispatch.reviewPrompt).toBe(
      reviewDispatch.reviewPrompt.trim(),
    );
    expect(reviewDispatch.reviewPrompt).toContain(
      "sanctuary_engineering_review_diff_chunk",
    );
    expect(reviewDispatch.reviewPrompt).toContain('"verdict":"approved"');
    expect(reviewDispatch.reviewPrompt).toContain(
      '"model":"openai/gpt-5.6-sol"',
    );
    expect(reviewDispatch.reviewPrompt).toContain(
      '"nextAction":"Human review and merge."',
    );
    expect(reviewDispatch.reviewPrompt).not.toContain('"decision":');
    expect(reviewDispatch.reviewPrompt).not.toContain("<untrusted_diff");
    const wrong = setup.tasks.add({
      runId: "wrong-reviewer",
      agentId: "sanctuary-coding-worker",
      label: null,
      title: reviewDispatch.reviewPrompt,
      createdAt: reviewDispatch.reviewStartedAt,
    });
    expect(() =>
      setup.controller().attachReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: reviewDispatch.expectedRevision,
        runId: wrong.runId,
      }),
    ).toThrow(/named Sanctuary code reviewer/);
    expect(() =>
      setup.controller().attachReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: reviewDispatch.expectedRevision - 1,
        runId: wrong.runId,
      }),
    ).toThrow(/revision conflict/);

    const wrongRequester = setup.tasks.add({
      runId: "wrong-reviewer-requester",
      agentId: reviewDispatch.reviewerAgentId,
      sessionKey: "agent:other-supervisor:test",
      label: null,
      title: reviewDispatch.reviewPrompt,
      createdAt: reviewDispatch.reviewStartedAt,
    });
    expect(() =>
      setup.controller().attachReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: reviewDispatch.expectedRevision,
        runId: wrongRequester.runId,
      }),
    ).toThrow(/named Sanctuary code reviewer/);

    const { reviewer, attached } = attachReviewer(setup, reviewDispatch);
    reviewer.status = "succeeded";
    reviewer.endedAt = 1_700_000_020_000;
    const staleReport = reviewReport(setup, reviewDispatch);
    staleReport.headSha = "c".repeat(40);
    await expect(
      setup.controller().reconcileReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: attached.revision,
        report: staleReport,
      }),
    ).rejects.toThrow(/does not match its task/);
    expect(
      setup.controller().status(setup.manifest.taskId, setup.manifestHash),
    ).toMatchObject({
      phase: "reviewer_running",
      flowStatus: "running",
    });
  });

  it("attaches the exact reviewer task when an inner task shares its run ID", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const reviewer = setup.tasks.add({
      runId: "shared-review-run-id",
      agentId: reviewDispatch.reviewerAgentId,
      label: null,
      title: reviewDispatch.reviewPrompt,
      createdAt: reviewDispatch.reviewStartedAt,
    });
    setup.tasks.add({
      runId: reviewer.runId,
      agentId: reviewDispatch.reviewerAgentId,
      sessionKey: "agent:sanctuary-code-reviewer:inner",
      label: null,
      title: `[Subagent Context]\n${reviewDispatch.reviewPrompt}`,
      createdAt: reviewDispatch.reviewStartedAt + 1,
    });

    expect(
      setup.controller().attachReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: reviewDispatch.expectedRevision,
        runId: reviewer.runId,
      }),
    ).toMatchObject({
      phase: "reviewer_running",
      reviewStatus: "running",
    });
  });

  it("ignores a historical matching reviewer outside the current review window", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    setup.tasks.add({
      runId: "historical-reviewer",
      agentId: reviewDispatch.reviewerAgentId,
      label: null,
      title: reviewDispatch.reviewPrompt,
      createdAt: reviewDispatch.reviewStartedAt - 1,
    });
    const current = setup.tasks.add({
      runId: "current-reviewer",
      agentId: reviewDispatch.reviewerAgentId,
      label: null,
      title: reviewDispatch.reviewPrompt,
      createdAt: reviewDispatch.reviewStartedAt,
    });

    const recovered = await setup.controller().recover();
    expect(recovered).toMatchObject({
      recoveredAttached: true,
      phase: "reviewer_running",
      reviewStatus: "running",
    });
    expect(
      setup.flows.records.get(reviewDispatch.flowId)?.stateJson.review.runId,
    ).toBe(current.runId);
  });

  it("blocks a failed reviewer instead of silently replacing it", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const { reviewer, attached } = attachReviewer(setup, reviewDispatch);
    reviewer.status = "failed";
    reviewer.error = "Reviewer runtime failed.";
    const blocked = await setup.controller().reconcileReview({
      flowId: reviewDispatch.flowId,
      expectedRevision: attached.revision,
    });
    expect(blocked).toMatchObject({
      phase: "blocked",
      flowStatus: "blocked",
      blockedSummary: "Reviewer runtime failed.",
    });
    expect(await setup.controller().recover()).toMatchObject({
      claimed: false,
      reason: "A prior engineering flow requires operator attention.",
    });
  });

  it("records, orders and charges the finite operator-authorized dispatch corrections", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const reviewDispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const { reviewer, attached } = attachReviewer(setup, reviewDispatch);
    const attachedFlow = setup.flows.records.get(reviewDispatch.flowId)!;
    const legacy = buildLegacyChunkedReviewPrompt({
      flowId: reviewDispatch.flowId,
      state: attachedFlow.stateJson,
      ciEvidence: attachedFlow.stateJson.ci.evidence,
      diff: setup.ci.diff(),
    });
    attachedFlow.stateJson.review.promptHash = legacy.promptHash;
    reviewer.title = legacy.prompt;
    reviewer.status = "succeeded";
    reviewer.endedAt = 1_700_000_020_000;

    expect(() =>
      setup.controller().redispatchReview({
        flowId: reviewDispatch.flowId,
        expectedRevision: attached.revision,
        priorRunId: reviewer.runId,
        reason: "missing_registered_review_tool",
      }),
    ).toThrow(/does not match the durable correction sequence/);

    const correction = setup.controller().redispatchReview({
      flowId: reviewDispatch.flowId,
      expectedRevision: attached.revision,
      priorRunId: reviewer.runId,
      reason: "invalid_dispatch_contract",
    });
    expect(correction).toMatchObject({
      reviewReady: true,
      expectedRevision: attached.revision + 1,
      reviewerAgentId: "sanctuary-code-reviewer",
    });
    expect(correction.reviewTaskName).toMatch(/_c1$/);
    expect(correction.reviewPrompt).toContain('"verdict":"approved"');
    const correctedState = setup.flows.records.get(
      correction.flowId,
    )!.stateJson;
    expect(correctedState.cumulativeCostCents).toBe(366);
    expect(correctedState.reviewHistory).toEqual([
      expect.objectContaining({
        kind: "invalid_dispatch_contract",
        correction: 1,
        runId: reviewer.runId,
        taskRunId: reviewer.id,
        costCents: 266,
      }),
    ]);

    expect(() =>
      setup.controller().redispatchReview({
        flowId: correction.flowId,
        expectedRevision: correction.expectedRevision,
        priorRunId: reviewer.runId,
        reason: "invalid_dispatch_contract",
      }),
    ).toThrow(/Only an attached reviewer/);

    const correctedReviewer = setup.tasks.add({
      runId: "run-reviewer-correction",
      agentId: correction.reviewerAgentId,
      label: null,
      title: correction.reviewPrompt,
      createdAt: correction.reviewStartedAt,
    });
    const correctionAttached = setup.controller().attachReview({
      flowId: correction.flowId,
      expectedRevision: correction.expectedRevision,
      runId: correctedReviewer.runId,
    });
    correctedReviewer.status = "succeeded";
    correctedReviewer.endedAt = correction.reviewStartedAt + 1_000;
    const registrationCorrection = setup.controller().redispatchReview({
      flowId: correction.flowId,
      expectedRevision: correctionAttached.revision,
      priorRunId: correctedReviewer.runId,
      reason: "missing_registered_review_tool",
    });
    expect(registrationCorrection).toMatchObject({
      reviewReady: true,
      expectedRevision: correctionAttached.revision + 1,
      reviewerAgentId: "sanctuary-code-reviewer",
    });
    expect(registrationCorrection.reviewTaskName).toMatch(/_c2$/);
    const secondCorrectedState = setup.flows.records.get(
      registrationCorrection.flowId,
    )!.stateJson;
    expect(secondCorrectedState.cumulativeCostCents).toBe(544);
    expect(secondCorrectedState.reviewHistory).toEqual([
      expect.objectContaining({
        kind: "invalid_dispatch_contract",
        correction: 1,
        costCents: 266,
      }),
      expect.objectContaining({
        kind: "missing_registered_review_tool",
        correction: 2,
        runId: correctedReviewer.runId,
        taskRunId: correctedReviewer.id,
        costCents: 178,
      }),
    ]);

    const finalReviewer = setup.tasks.add({
      runId: "run-reviewer-final",
      agentId: registrationCorrection.reviewerAgentId,
      label: null,
      title: registrationCorrection.reviewPrompt,
      createdAt: registrationCorrection.reviewStartedAt,
    });
    const finalAttached = setup.controller().attachReview({
      flowId: registrationCorrection.flowId,
      expectedRevision: registrationCorrection.expectedRevision,
      runId: finalReviewer.runId,
    });
    finalReviewer.status = "succeeded";
    finalReviewer.endedAt = registrationCorrection.reviewStartedAt + 1_000;
    const finished = await setup.controller().reconcileReview({
      flowId: registrationCorrection.flowId,
      expectedRevision: finalAttached.revision,
      report: reviewReport(setup, registrationCorrection),
    });
    expect(finished).toMatchObject({
      phase: "succeeded",
      flowStatus: "succeeded",
      reviewVerdict: "approved",
      cumulativeCostCents: 569,
    });
  });

  it("upgrades a ready legacy embedded-diff dispatch without spawning twice", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const dispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const flow = setup.flows.records.get(dispatch.flowId)!;
    const legacy = buildLegacyReviewPrompt({
      state: flow.stateJson,
      ciEvidence: flow.stateJson.ci.evidence,
      diff: setup.ci.diff(),
    });
    flow.stateJson.review.promptHash = legacy.promptHash;
    const beforeRevision = flow.revision;

    const recovered = await setup.controller().recover();
    expect(recovered).toMatchObject({
      reviewReady: true,
      expectedRevision: beforeRevision + 1,
      reviewerAgentId: "sanctuary-code-reviewer",
    });
    expect(recovered.reviewPrompt).not.toContain("<untrusted_diff");
    expect(recovered.reviewPrompt).toContain(
      "sanctuary_engineering_review_diff_chunk",
    );
    expect(setup.tasks.records).toHaveLength(1);
  });
  it("upgrades a ready pre-bound legacy chunked dispatch before spawning", async () => {
    const setup = fixture();
    const reached = await reachCi(setup);
    const dispatch = setup.controller().inspectCi({
      flowId: reached.ciPending.flowId,
      expectedRevision: reached.ciPending.revision,
    });
    const flow = setup.flows.records.get(dispatch.flowId)!;
    const legacy = buildLegacyBoundedReviewPrompt({
      flowId: flow.flowId,
      state: flow.stateJson,
      ciEvidence: flow.stateJson.ci.evidence,
      diff: setup.ci.diff(),
    });
    expect(legacy.prompt).not.toContain(
      "path and line may be null.\n\n\n```json",
    );
    flow.stateJson.review.promptHash = legacy.promptHash;
    const staleWindow = {
      startedAt: flow.stateJson.review.startedAt,
      deadlineAt: flow.stateJson.review.deadlineAt,
    };
    setup.advance(3_600_001);
    const beforeRevision = flow.revision;
    const recovered = await setup.controller().recover();
    expect(recovered).toMatchObject({
      reviewReady: true,
      expectedRevision: beforeRevision + 1,
      reviewerAgentId: "sanctuary-code-reviewer",
      reviewStartedAt: staleWindow.deadlineAt + 1,
      reviewDeadlineAt: staleWindow.deadlineAt + 3_600_001,
    });
    expect(recovered.reviewPrompt).toContain('"criterionIndex":0');
    const upgradedFlow = setup.flows.records.get(dispatch.flowId)!;
    Object.assign(upgradedFlow.stateJson.review, {
      ...staleWindow,
      deadlineAt: upgradedFlow.stateJson.lastCheckpoint.at + 1_000,
    });
    const reviewer = setup.tasks.add({
      runId: "run-reviewer-after-upgrade",
      agentId: recovered.reviewerAgentId,
      title: recovered.reviewPrompt,
      createdAt: recovered.reviewStartedAt + 1_001,
    });
    setup.advance(3_600_001);
    const resumed = await setup.controller().recover();
    expect(resumed).toMatchObject({
      recoveredAttached: true,
      phase: "reviewer_running",
    });
    const attachedReview = setup.flows.records.get(dispatch.flowId)!.stateJson
      .review;
    expect(attachedReview.taskRunId).toBe(reviewer.id);
    expect(attachedReview.deadlineAt).toBe(
      recovered.reviewDeadlineAt + 3_600_001,
    );
    const productionLikeState = clone(flow.stateJson);
    productionLikeState.manifest.acceptanceCriteria = Array.from(
      { length: 50 },
      (_, index) => `Criterion ${index + 1}`,
    );
    productionLikeState.completion.acceptanceResults =
      productionLikeState.manifest.acceptanceCriteria.map(
        (criterion: string, index: number) => ({
          criterion,
          status: "passed",
          evidence: `Specific worker evidence ${index + 1}.`,
        }),
      );
    const bounded = buildReviewPrompt({
      flowId: flow.flowId,
      state: productionLikeState,
      ciEvidence: productionLikeState.ci.evidence,
      diff: setup.ci.diff(),
    });
    productionLikeState.review.promptHash = bounded.promptHash;
    const dispatchFor = (state: Value) =>
      buildReviewDispatch({
        flow: { ...flow, stateJson: state },
        state,
        ciRuntime: setup.ci,
        runtimeTimeoutSeconds: 3_600,
      });
    expect(
      JSON.stringify(dispatchFor(productionLikeState), null, 2).length,
    ).toBeLessThanOrEqual(REVIEW_DISPATCH_MAX_CHARACTERS);
    expect(
      bounded.prompt.match(/COPY each task\.acceptanceCriteria item exactly/g),
    ).toHaveLength(1);
    productionLikeState.manifest.objective = "oversized ".repeat(2_000);
    const oversized = buildReviewPrompt({
      flowId: flow.flowId,
      state: productionLikeState,
      ciEvidence: productionLikeState.ci.evidence,
      diff: setup.ci.diff(),
    });
    productionLikeState.review.promptHash = oversized.promptHash;
    expect(() => dispatchFor(productionLikeState)).toThrow(
      "serialized independent review dispatch",
    );
  });
});
