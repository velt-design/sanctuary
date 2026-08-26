// @vitest-environment node

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createEngineeringSupervisionController } from "../infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-runtime.mjs";

type RecordValue = Record<string, any>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

class FakeFlows {
  records = new Map<string, RecordValue>();
  nextId = 1;

  createManaged(input: RecordValue) {
    const flow = {
      flowId: `flow-supervision-${this.nextId++}`,
      syncMode: "managed",
      controllerId: input.controllerId,
      revision: 0,
      status: input.status ?? "queued",
      notifyPolicy: input.notifyPolicy ?? "done_only",
      goal: input.goal,
      currentStep: input.currentStep,
      stateJson: clone(input.stateJson),
      waitJson: input.waitJson,
      blockedTaskId: undefined,
      blockedSummary: undefined,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      endedAt: undefined,
    };
    this.records.set(flow.flowId, flow);
    return flow;
  }

  get(flowId: string) {
    return this.records.get(flowId);
  }

  list() {
    return [...this.records.values()];
  }

  mutate(input: RecordValue, patch: RecordValue) {
    const current = this.records.get(input.flowId);
    if (!current) return { applied: false, code: "not_found" };
    if (current.revision !== input.expectedRevision) {
      return { applied: false, code: "revision_conflict", current };
    }
    const flow = {
      ...current,
      ...patch,
      revision: current.revision + 1,
      updatedAt: input.updatedAt ?? current.updatedAt,
    };
    this.records.set(flow.flowId, flow);
    return { applied: true, flow };
  }

  setWaiting = (input: RecordValue) =>
    this.mutate(input, {
      status:
        input.blockedTaskId || input.blockedSummary ? "blocked" : "waiting",
      currentStep: input.currentStep,
      stateJson: clone(input.stateJson),
      waitJson: clone(input.waitJson),
      blockedTaskId: input.blockedTaskId ?? undefined,
      blockedSummary: input.blockedSummary ?? undefined,
      endedAt: undefined,
    });

  resume = (input: RecordValue) =>
    this.mutate(input, {
      status: input.status ?? "queued",
      currentStep: input.currentStep,
      stateJson: clone(input.stateJson),
      waitJson: undefined,
      blockedTaskId: undefined,
      blockedSummary: undefined,
      endedAt: undefined,
    });

  finish = (input: RecordValue) =>
    this.mutate(input, {
      status: "succeeded",
      currentStep: input.currentStep,
      stateJson: clone(input.stateJson),
      waitJson: undefined,
      blockedTaskId: undefined,
      blockedSummary: undefined,
      endedAt: input.endedAt,
    });

  fail = (input: RecordValue) =>
    this.mutate(input, {
      status: "failed",
      stateJson: clone(input.stateJson),
      waitJson: undefined,
      blockedTaskId: input.blockedTaskId ?? undefined,
      blockedSummary: input.blockedSummary ?? undefined,
      endedAt: input.endedAt,
    });
}

class FakeTasks {
  records = new Map<string, RecordValue>();

  add(input: RecordValue) {
    const task = {
      id: input.id ?? `native-${this.records.size + 1}`,
      runtime: "subagent",
      status: "running",
      agentId: "sanctuary-coding-worker",
      childSessionKey: `agent:sanctuary-coding-worker:subagent:${this.records.size + 1}`,
      ...input,
    };
    this.records.set(task.runId, task);
    return task;
  }

  resolve = (token: string) =>
    this.records.get(token) ??
    [...this.records.values()].find((task) => task.id === token);

  list = () => [...this.records.values()];

  cancel = async ({ taskId }: { taskId: string }) => {
    const task = [...this.records.values()].find(
      (entry) => entry.id === taskId,
    );
    if (!task) return { found: false, cancelled: false, reason: "missing" };
    task.status = "cancelled";
    task.endedAt = 1_700_000_100_000;
    return { found: true, cancelled: true, task };
  };
}

function manifest(
  suffix: string,
  options: { dependencies?: string[]; maxAttempts?: number } = {},
) {
  return {
    schema: "sanctuary-engineering-task-v1",
    taskId: `eng_20260826_${suffix}`,
    goalId: "goal_20260826_autonomous_engineering",
    objective: `Complete ${suffix} through durable supervision.`,
    requestedBy: "Test operator",
    base: { ref: "main", sha: "a".repeat(40) },
    branch: `ai/test-${suffix.replaceAll("_", "-")}`,
    risk: "low",
    ownerLane: "test-supervision",
    roles: {
      supervisor: "engineering_lead",
      worker: "coding_worker",
      reviewer: "code_reviewer",
    },
    readFirst: ["AGENTS.md"],
    ownedPaths: ["docs/**"],
    excludedPaths: ["supabase/**"],
    dependencies: options.dependencies ?? [],
    acceptanceCriteria: ["The durable task finishes safely."],
    verification: {
      focusedCommands: ["npm test"],
      ciChecks: ["Fixture CI"],
      visualEvidence: { required: false, scenarios: [] },
    },
    limits: {
      maxWorkers: 1,
      maxAttempts: options.maxAttempts ?? 3,
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

function fixture() {
  const flows = new FakeFlows();
  const tasks = new FakeTasks();
  const lanes = new Map<string, RecordValue>();
  let clock = 1_700_000_000_000;
  const hash = (value: unknown) =>
    `sha256:${createHash("sha256")
      .update(`${JSON.stringify(value, null, 2)}\n`)
      .digest("hex")}`;
  const contractAdapter = {
    resolve(value: RecordValue) {
      const resolved = clone(value);
      return { manifest: resolved, manifestHash: hash(resolved) };
    },
    validateCompletion(value: RecordValue) {
      if (value.schema !== "sanctuary-engineering-completion-v1") {
        throw new Error("invalid completion");
      }
      return clone(value);
    },
  };
  const laneRuntime = {
    provision(value: RecordValue) {
      const identity = hash(value);
      let lane = lanes.get(identity);
      if (!lane) {
        lane = {
          taskId: value.taskId,
          manifestHash: identity,
          state: "active",
          branch: value.branch,
          baseSha: value.base.sha,
          headSha: value.base.sha,
          worktreePath: `/runtime/tasks/${value.taskId}/repo`,
          clean: true,
          changedPaths: [],
          pullRequest: null,
          workerPrompt: `Bound prompt for ${value.taskId}.`,
        };
        lanes.set(identity, lane);
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
      contractAdapter,
      laneRuntime,
      repoRoot: "/repo",
      stateDir: "/state",
      runtimeTimeoutSeconds: 3600,
      runtimeConfig: {
        agents: { defaults: { subagents: { runTimeoutSeconds: 3600 } } },
      },
      now: () => clock,
    });
  return {
    flows,
    tasks,
    lanes,
    controller,
    advance: (milliseconds: number) => {
      clock += milliseconds;
    },
  };
}

function attachRunning(
  setup: ReturnType<typeof fixture>,
  dispatch: RecordValue,
) {
  const task = setup.tasks.add({
    runId: `run-${dispatch.taskId}-${dispatch.attempt}`,
    label: dispatch.taskName,
    title: dispatch.workerPrompt,
    createdAt: dispatch.attemptStartedAt,
  });
  const attached = setup.controller().attach({
    flowId: dispatch.flowId,
    expectedRevision: dispatch.expectedRevision,
    runId: task.runId,
  });
  return { task, attached };
}

function completion(
  taskManifest: RecordValue,
  dispatch: RecordValue,
  task: RecordValue,
) {
  return {
    schema: "sanctuary-engineering-completion-v1",
    taskId: taskManifest.taskId,
    manifestHash: dispatch.manifestHash,
    outcome: "succeeded",
    branch: taskManifest.branch,
    baseSha: taskManifest.base.sha,
    headSha: "b".repeat(40),
    pullRequest: {
      number: 123,
      url: "https://github.com/velt-design/sanctuary/pull/123",
      draft: true,
    },
    changedPaths: ["docs/result.md"],
    acceptanceResults: [
      {
        criterion: taskManifest.acceptanceCriteria[0],
        status: "passed",
        evidence: "Fixture passed.",
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
    ciChecks: [{ name: "Fixture CI", status: "pending", url: null }],
    worker: {
      agent: "sanctuary-coding-worker",
      model: "openai/gpt-5.6-sol",
      sessionIds: ["controller_bound"],
      attempts: dispatch.attempt,
      costCents: 100 * dispatch.attempt,
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
    limitations: ["CI remains pending."],
    nextAction: "Human review after CI.",
  };
}

describe("durable engineering supervision", () => {
  it("enqueues an exact manifest once and restores it through a new controller", () => {
    const setup = fixture();
    const task = manifest("durable_enqueue");
    const first = setup.controller().enqueue(task);
    const resumed = setup.controller().enqueue(task);

    expect(first).toMatchObject({
      enqueued: true,
      phase: "queued",
      revision: 0,
    });
    expect(resumed).toMatchObject({
      enqueued: false,
      resumed: true,
      flowId: first.flowId,
    });
    expect(setup.flows.records.size).toBe(1);
    expect(() =>
      setup.controller().enqueue({ ...task, objective: "Changed objective." }),
    ).toThrow(/another manifest/);
  });

  it("skips unmet dependencies and never allocates a second active worker", () => {
    const setup = fixture();
    const blocked = manifest("dependent", {
      dependencies: ["eng_20260826_missing_dependency"],
    });
    const independent = manifest("independent");
    setup.controller().enqueue(blocked);
    setup.advance(1);
    setup.controller().enqueue(independent);

    const dispatch = setup.controller().claim();
    const repeated = setup.controller().claim();

    expect(dispatch).toMatchObject({
      claimed: true,
      taskId: independent.taskId,
      attempt: 1,
    });
    expect(repeated).toMatchObject({
      claimed: true,
      flowId: dispatch.flowId,
      attempt: 1,
      taskName: dispatch.taskName,
    });
    expect(
      setup
        .controller()
        .status(
          blocked.taskId,
          setup.controller().enqueue(blocked).manifestHash,
        ),
    ).toMatchObject({
      phase: "dependency_wait",
    });
    const { attached } = attachRunning(setup, dispatch);
    expect(setup.controller().claim()).toMatchObject({
      claimed: false,
      active: { phase: "worker_running", revision: attached.revision },
    });
  });

  it("recovers a native worker spawned before its durable attachment", async () => {
    const setup = fixture();
    const task = manifest("spawn_attach_recovery");
    setup.controller().enqueue(task);
    const dispatch = setup.controller().claim();
    setup.tasks.add({
      runId: "run-historical-matching-worker",
      label: dispatch.taskName,
      title: dispatch.workerPrompt,
      createdAt: dispatch.attemptStartedAt - 1,
    });
    const native = setup.tasks.add({
      runId: "run-spawn-attach-recovery",
      label: dispatch.taskName,
      title: dispatch.workerPrompt,
      createdAt: dispatch.attemptStartedAt,
    });

    const recovered = await setup.controller().recover();
    expect(recovered).toMatchObject({
      recoveredAttached: true,
      waiting: true,
      phase: "worker_running",
      attempts: 1,
      activeRunId: native.runId,
    });
    expect(setup.tasks.records.size).toBe(2);
    expect(await setup.controller().recover()).toMatchObject({
      waiting: true,
      phase: "worker_running",
      attempts: 1,
      activeRunId: native.runId,
    });
  });

  it("blocks instead of choosing between duplicate unbound native workers", async () => {
    const setup = fixture();
    const task = manifest("duplicate_spawn_recovery");
    setup.controller().enqueue(task);
    const dispatch = setup.controller().claim();
    for (const suffix of ["one", "two"]) {
      setup.tasks.add({
        runId: `run-duplicate-${suffix}`,
        label: dispatch.taskName,
        title: dispatch.workerPrompt,
        createdAt: dispatch.attemptStartedAt,
      });
    }

    const blocked = await setup.controller().recover();
    expect(blocked).toMatchObject({
      recoveredAttached: false,
      phase: "blocked",
      flowStatus: "blocked",
      attempts: 1,
    });
  });

  it("rejects stale revisions and the wrong native worker identity", () => {
    const setup = fixture();
    const task = manifest("identity_fence");
    setup.controller().enqueue(task);
    const dispatch = setup.controller().claim();
    setup.tasks.add({
      runId: "run-wrong-agent",
      agentId: "other-agent",
      label: dispatch.taskName,
      title: dispatch.workerPrompt,
      createdAt: dispatch.attemptStartedAt,
    });

    expect(() =>
      setup.controller().attach({
        flowId: dispatch.flowId,
        expectedRevision: dispatch.expectedRevision,
        runId: "run-wrong-agent",
      }),
    ).toThrow(/named Sanctuary coding worker/);
    expect(() =>
      setup.controller().attach({
        flowId: dispatch.flowId,
        expectedRevision: dispatch.expectedRevision - 1,
        runId: "run-wrong-agent",
      }),
    ).toThrow(/revision conflict/);

    setup.tasks.add({
      runId: "run-wrong-label",
      label: "eng_wrong_label_a1",
      title: dispatch.workerPrompt,
      createdAt: dispatch.attemptStartedAt,
    });
    expect(() =>
      setup.controller().attach({
        flowId: dispatch.flowId,
        expectedRevision: dispatch.expectedRevision,
        runId: "run-wrong-label",
      }),
    ).toThrow(/named Sanctuary coding worker/);

    const stored = setup.flows.records.get(dispatch.flowId)!;
    stored.stateJson.manifest.objective = "Tampered durable objective.";
    expect(() =>
      setup.controller().attach({
        flowId: dispatch.flowId,
        expectedRevision: dispatch.expectedRevision,
        runId: "run-wrong-agent",
      }),
    ).toThrow(/canonical validation/);
  });

  it("recovers a lost native task once and stops at the manifest attempt limit", async () => {
    const setup = fixture();
    const taskManifest = manifest("bounded_retry", { maxAttempts: 2 });
    setup.controller().enqueue(taskManifest);
    const first = setup.controller().claim();
    const firstRun = attachRunning(setup, first);
    firstRun.task.status = "lost";
    firstRun.task.endedAt = 1_700_000_010_000;

    const retry = await setup.controller().reconcile({
      flowId: first.flowId,
      expectedRevision: firstRun.attached.revision,
    });
    expect(retry).toMatchObject({
      retryReady: true,
      phase: "retry_ready",
      attempts: 1,
      cumulativeCostCents: 225,
    });

    const second = await setup.controller().recover();
    expect(second).toMatchObject({
      claimed: true,
      flowId: first.flowId,
      attempt: 2,
    });
    expect(second.worktreePath).toBe(first.worktreePath);
    const secondRun = attachRunning(setup, second);
    secondRun.task.status = "timed_out";
    const exhausted = await setup.controller().reconcile({
      flowId: second.flowId,
      expectedRevision: secondRun.attached.revision,
    });
    expect(exhausted).toMatchObject({
      retryReady: false,
      phase: "failed",
      flowStatus: "failed",
      attempts: 2,
      cumulativeCostCents: 562,
    });
  });

  it("cancels an overdue native run before allocating a bounded retry", async () => {
    const setup = fixture();
    const taskManifest = manifest("deadline_retry", { maxAttempts: 2 });
    setup.controller().enqueue(taskManifest);
    const dispatch = setup.controller().claim();
    const running = attachRunning(setup, dispatch);
    setup.advance(3_600_001);

    const result = await setup.controller().reconcile({
      flowId: dispatch.flowId,
      expectedRevision: running.attached.revision,
    });
    expect(running.task.status).toBe("cancelled");
    expect(result).toMatchObject({
      retryReady: true,
      phase: "retry_ready",
      cumulativeCostCents: 225,
    });
  });

  it("requires strict completion and exact lane evidence before entering CI", async () => {
    const setup = fixture();
    const taskManifest = manifest("strict_completion");
    setup.controller().enqueue(taskManifest);
    const dispatch = setup.controller().claim();
    const running = attachRunning(setup, dispatch);
    running.task.status = "succeeded";
    running.task.endedAt = 1_700_000_010_000;

    const waiting = await setup.controller().reconcile({
      flowId: dispatch.flowId,
      expectedRevision: running.attached.revision,
    });
    expect(waiting).toMatchObject({
      phase: "awaiting_completion",
      waiting: true,
    });

    const report = completion(taskManifest, dispatch, running.task);
    const lane = setup.lanes.get(dispatch.manifestHash)!;
    Object.assign(lane, {
      state: "published",
      headSha: report.headSha,
      changedPaths: report.changedPaths,
      pullRequest: report.pullRequest,
    });
    const ciPending = await setup.controller().reconcile({
      flowId: dispatch.flowId,
      expectedRevision: waiting.revision,
      completion: report,
    });
    expect(ciPending).toMatchObject({
      phase: "ci_pending",
      flowStatus: "waiting",
      cumulativeCostCents: 100,
    });
    expect(() =>
      setup.controller().status(taskManifest.taskId, dispatch.manifestHash),
    ).not.toThrow();
    const stored = setup.flows.records.get(dispatch.flowId)!;
    stored.stateJson.completion.taskId = "eng_20260826_tampered_completion";
    expect(() =>
      setup.controller().status(taskManifest.taskId, dispatch.manifestHash),
    ).toThrow(/completion evidence/);
  });

  it("blocks unclassified native failure instead of retrying it", async () => {
    const setup = fixture();
    const taskManifest = manifest("failed_block");
    setup.controller().enqueue(taskManifest);
    const dispatch = setup.controller().claim();
    const running = attachRunning(setup, dispatch);
    running.task.status = "failed";
    running.task.error = "Unknown worker failure";

    const blocked = await setup.controller().reconcile({
      flowId: dispatch.flowId,
      expectedRevision: running.attached.revision,
    });
    expect(blocked).toMatchObject({
      retryReady: false,
      phase: "blocked",
      flowStatus: "blocked",
      attempts: 1,
    });
  });

  it("persists a bounded cumulative cost envelope across a retry", async () => {
    const setup = fixture();
    const taskManifest = manifest("bounded_cost", { maxAttempts: 2 });
    taskManifest.limits.maxCostCents = 100;
    setup.controller().enqueue(taskManifest);
    const first = setup.controller().claim();
    expect(first).toMatchObject({
      priorCumulativeCostCents: 0,
      attemptBudgetCents: 25,
    });
    const firstRun = attachRunning(setup, first);
    firstRun.task.status = "succeeded";
    firstRun.task.endedAt = 1_700_000_010_000;
    const failedReport = completion(taskManifest, first, firstRun.task);
    failedReport.outcome = "failed";
    failedReport.nextAction = "Retry the clean lane.";
    failedReport.worker.costCents = 26;
    await expect(
      setup.controller().reconcile({
        flowId: first.flowId,
        expectedRevision: firstRun.attached.revision,
        completion: failedReport,
      }),
    ).rejects.toThrow(/does not match its flow and attempt/);
    failedReport.worker.costCents = 25;

    const retry = await setup.controller().reconcile({
      flowId: first.flowId,
      expectedRevision: firstRun.attached.revision,
      completion: failedReport,
    });
    expect(retry).toMatchObject({ retryReady: true, cumulativeCostCents: 25 });

    const second = await setup.controller().recover();
    expect(second).toMatchObject({
      attempt: 2,
      priorCumulativeCostCents: 25,
      attemptBudgetCents: 37,
    });
    const secondRun = attachRunning(setup, second);
    secondRun.task.status = "succeeded";
    secondRun.task.endedAt = 1_700_000_020_000;
    const successReport = completion(taskManifest, second, secondRun.task);
    successReport.worker.costCents = 62;
    const lane = setup.lanes.get(second.manifestHash)!;
    Object.assign(lane, {
      state: "published",
      headSha: successReport.headSha,
      changedPaths: successReport.changedPaths,
      pullRequest: successReport.pullRequest,
    });

    const ciPending = await setup.controller().reconcile({
      flowId: second.flowId,
      expectedRevision: secondRun.attached.revision,
      completion: successReport,
    });
    expect(ciPending).toMatchObject({
      phase: "ci_pending",
      cumulativeCostCents: 62,
    });
  });
});
