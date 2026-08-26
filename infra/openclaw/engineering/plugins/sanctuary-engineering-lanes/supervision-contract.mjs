import { assertTaskIdentity } from "./lane-contract.mjs";

const ENGINEERING_SUPERVISION_SCHEMA = "sanctuary-engineering-supervision-v1";
export const ENGINEERING_SUPERVISION_CONTROLLER =
  "sanctuary-engineering/supervisor-v1";
export const ENGINEERING_WORKER_AGENT = "sanctuary-coding-worker";
export const ENGINEERING_SUPERVISION_TOOL_NAMES = Object.freeze([
  "sanctuary_engineering_supervision_enqueue",
  "sanctuary_engineering_supervision_claim",
  "sanctuary_engineering_supervision_attach",
  "sanctuary_engineering_supervision_reconcile",
  "sanctuary_engineering_supervision_recover",
  "sanctuary_engineering_supervision_status",
]);

const SUPERVISION_PHASES = new Set([
  "queued",
  "dependency_wait",
  "worker_ready",
  "worker_running",
  "awaiting_completion",
  "retry_ready",
  "succeeded",
  "blocked",
  "failed",
]);

const ATTEMPT_STATUSES = new Set([
  "ready",
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "lost",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is not a valid timestamp.`);
  }
}

export function required(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

export function mutation(result, label) {
  if (!result?.applied) {
    throw new Error(
      `${label} failed${result?.code ? `: ${result.code}` : "."}`,
    );
  }
  return result.flow;
}

export function timestamp(now) {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("The supervision clock returned an invalid timestamp.");
  }
  return value;
}

function assertAttempt(attempt, index) {
  if (
    !isRecord(attempt) ||
    attempt.number !== index + 1 ||
    !ATTEMPT_STATUSES.has(attempt.status) ||
    typeof attempt.dispatchKey !== "string" ||
    !attempt.dispatchKey ||
    typeof attempt.taskName !== "string" ||
    !/^eng_[a-f0-9]{12}_a[1-9][0-9]*$/.test(attempt.taskName) ||
    typeof attempt.worktreePath !== "string" ||
    !attempt.worktreePath ||
    !Number.isSafeInteger(attempt.budgetCents) ||
    attempt.budgetCents < 0
  ) {
    throw new Error("The supervision attempt ledger is invalid.");
  }
  assertTimestamp(attempt.startedAt, "Attempt start");
  assertTimestamp(attempt.deadlineAt, "Attempt deadline");
  assertTimestamp(attempt.endedAt, "Attempt end", { nullable: true });
  if (
    attempt.deadlineAt < attempt.startedAt ||
    (attempt.endedAt !== null && attempt.endedAt < attempt.startedAt)
  ) {
    throw new Error("The supervision attempt timestamps are out of order.");
  }
  for (const field of ["runId", "taskRunId", "childSessionKey", "error"]) {
    if (attempt[field] !== null && typeof attempt[field] !== "string") {
      throw new Error(`Attempt ${field} is invalid.`);
    }
  }
  if (
    !Number.isSafeInteger(attempt.cumulativeCostCents) ||
    attempt.cumulativeCostCents < 0
  ) {
    throw new Error("Attempt cost evidence is invalid.");
  }
}

function assertCheckpoint(checkpoint) {
  if (
    !isRecord(checkpoint) ||
    typeof checkpoint.kind !== "string" ||
    !checkpoint.kind ||
    typeof checkpoint.summary !== "string" ||
    !checkpoint.summary
  ) {
    throw new Error("The supervision checkpoint is invalid.");
  }
  assertTimestamp(checkpoint.at, "Checkpoint");
}

export function createSupervisionState({ manifest, manifestHash, now }) {
  assertTaskIdentity(manifest.taskId, manifestHash);
  return {
    schema: ENGINEERING_SUPERVISION_SCHEMA,
    controllerId: ENGINEERING_SUPERVISION_CONTROLLER,
    taskId: manifest.taskId,
    manifestHash,
    manifest,
    phase: "queued",
    attempts: [],
    cumulativeCostCents: 0,
    completion: null,
    lastCheckpoint: {
      kind: "enqueued",
      at: now,
      summary: "Validated manifest entered the durable supervision queue.",
    },
  };
}

export function readSupervisionState(flow) {
  const state = flow?.stateJson;
  if (
    flow?.syncMode !== "managed" ||
    flow?.controllerId !== ENGINEERING_SUPERVISION_CONTROLLER ||
    !isRecord(state) ||
    state.schema !== ENGINEERING_SUPERVISION_SCHEMA ||
    state.controllerId !== ENGINEERING_SUPERVISION_CONTROLLER ||
    !SUPERVISION_PHASES.has(state.phase) ||
    !isRecord(state.manifest) ||
    !isRecord(state.manifest.limits) ||
    !Number.isSafeInteger(state.manifest.limits.maxAttempts) ||
    state.manifest.limits.maxAttempts < 1 ||
    !Number.isSafeInteger(state.manifest.limits.maxCostCents) ||
    state.manifest.limits.maxCostCents < 0 ||
    !Array.isArray(state.attempts)
  ) {
    throw new Error("The managed flow is not a Sanctuary supervision flow.");
  }
  assertTaskIdentity(state.taskId, state.manifestHash);
  if (
    state.manifest.taskId !== state.taskId ||
    state.attempts.length > state.manifest.limits.maxAttempts ||
    !Number.isSafeInteger(state.cumulativeCostCents) ||
    state.cumulativeCostCents < 0 ||
    state.cumulativeCostCents > state.manifest.limits.maxCostCents ||
    !isRecord(state.lastCheckpoint) ||
    (state.completion !== null && !isRecord(state.completion))
  ) {
    throw new Error("The supervision state does not match its manifest.");
  }
  let priorCostCents = 0;
  state.attempts.forEach((attempt, index) => {
    assertAttempt(attempt, index);
    if (
      attempt.cumulativeCostCents < priorCostCents ||
      attempt.cumulativeCostCents > state.manifest.limits.maxCostCents ||
      attempt.budgetCents > state.manifest.limits.maxCostCents - priorCostCents
    ) {
      throw new Error("The supervision attempt cost ledger is invalid.");
    }
    priorCostCents = attempt.cumulativeCostCents;
  });
  if (
    state.attempts.length > 0 &&
    priorCostCents !== state.cumulativeCostCents
  ) {
    throw new Error(
      "The supervision cumulative cost does not match its ledger.",
    );
  }
  if (
    state.completion !== null &&
    (!isRecord(state.completion.worker) ||
      state.completion.taskId !== state.taskId ||
      state.completion.manifestHash !== state.manifestHash ||
      state.completion.branch !== state.manifest.branch ||
      state.completion.baseSha !== state.manifest.base.sha ||
      !Number.isSafeInteger(state.completion.worker.attempts) ||
      state.completion.worker.attempts > state.attempts.length ||
      !Number.isSafeInteger(state.completion.worker.costCents) ||
      state.completion.worker.costCents > state.cumulativeCostCents ||
      (state.phase === "succeeded" &&
        state.completion.outcome !== "succeeded") ||
      (state.completion.outcome === "succeeded" && state.phase !== "succeeded"))
  ) {
    throw new Error("The supervision completion evidence is invalid.");
  }
  assertCheckpoint(state.lastCheckpoint);
  return state;
}

export function isSupervisionFlow(flow) {
  return (
    flow?.syncMode === "managed" &&
    flow?.controllerId === ENGINEERING_SUPERVISION_CONTROLLER &&
    flow?.stateJson?.schema === ENGINEERING_SUPERVISION_SCHEMA
  );
}

export function assertExpectedRevision(flow, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error("The expected Task Flow revision is invalid.");
  }
  if (flow.revision !== expectedRevision) {
    throw new Error(
      `Task Flow revision conflict: expected ${expectedRevision}, found ${flow.revision}.`,
    );
  }
}

export function checkpointState(state, kind, summary, now, patch = {}) {
  return {
    ...state,
    ...patch,
    lastCheckpoint: { kind, at: now, summary },
  };
}

export function activeAttempt(state) {
  return state.attempts.at(-1) ?? null;
}

export function replaceActiveAttempt(state, attempt, patch) {
  return {
    ...state,
    attempts: [...state.attempts.slice(0, -1), { ...attempt, ...patch }],
  };
}

export function publicSupervision(flow) {
  const state = readSupervisionState(flow);
  const attempt = activeAttempt(state);
  return {
    flowId: flow.flowId,
    revision: flow.revision,
    flowStatus: flow.status,
    currentStep: flow.currentStep ?? null,
    taskId: state.taskId,
    manifestHash: state.manifestHash,
    phase: state.phase,
    attempts: state.attempts.length,
    maxAttempts: state.manifest.limits.maxAttempts,
    cumulativeCostCents: state.cumulativeCostCents,
    maxCostCents: state.manifest.limits.maxCostCents,
    activeRunId: attempt?.runId ?? null,
    activeTaskRunId: attempt?.taskRunId ?? null,
    activeTaskStatus: attempt?.status ?? null,
    activeAttemptBudgetCents: attempt?.budgetCents ?? null,
    attemptHistory: state.attempts.map((entry) => ({
      number: entry.number,
      dispatchKey: entry.dispatchKey,
      taskName: entry.taskName,
      status: entry.status,
      budgetCents: entry.budgetCents,
      cumulativeCostCents: entry.cumulativeCostCents,
      runId: entry.runId,
      taskRunId: entry.taskRunId,
      startedAt: entry.startedAt,
      deadlineAt: entry.deadlineAt,
      endedAt: entry.endedAt,
      error: entry.error,
    })),
    lastCheckpoint: state.lastCheckpoint,
    blockedSummary: flow.blockedSummary ?? null,
  };
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
