import { createHash } from "node:crypto";

import { assertTaskIdentity } from "./lane-contract.mjs";

const ENGINEERING_SUPERVISION_SCHEMA = "sanctuary-engineering-supervision-v2";
export const ENGINEERING_SUPERVISION_CONTROLLER =
  "sanctuary-engineering/supervisor-v1";
export const ENGINEERING_SUPERVISOR_AGENT = "sanctuary-engineering-supervisor";
export const ENGINEERING_WORKER_AGENT = "sanctuary-coding-worker";
export const ENGINEERING_SUPERVISION_TOOL_NAMES = Object.freeze([
  "sanctuary_engineering_supervision_enqueue",
  "sanctuary_engineering_supervision_claim",
  "sanctuary_engineering_supervision_attach",
  "sanctuary_engineering_supervision_reconcile",
  "sanctuary_engineering_supervision_recover",
  "sanctuary_engineering_supervision_status",
  "sanctuary_engineering_supervision_ci",
  "sanctuary_engineering_review_attach",
  "sanctuary_engineering_review_reconcile",
  "sanctuary_engineering_review_redispatch",
]);

const SUPERVISION_PHASES = new Set([
  "queued",
  "dependency_wait",
  "worker_ready",
  "worker_running",
  "awaiting_completion",
  "ci_pending",
  "reviewer_ready",
  "reviewer_running",
  "awaiting_review",
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
const CI_CLASSIFICATIONS = new Set([
  "passed",
  "pending",
  "transient",
  "repair_required",
  "blocked",
]);
const CI_CHECK_DISPOSITIONS = new Set([
  "passed",
  "pending",
  "transient",
  "actionable",
  "blocked",
]);
const REVIEW_STATUSES = new Set([
  "ready",
  "queued",
  "running",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "lost",
  "changes_requested",
  "blocked",
]);
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

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

function hashJson(value) {
  return `sha256:${createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex")}`;
}

function expectedCiClassification(checks) {
  if (checks.some((check) => check.disposition === "blocked")) {
    return "blocked";
  }
  if (checks.some((check) => check.disposition === "pending")) {
    return "pending";
  }
  if (checks.some((check) => check.disposition === "actionable")) {
    return "repair_required";
  }
  if (checks.some((check) => check.disposition === "transient")) {
    return "transient";
  }
  return "passed";
}

function validOptionalString(value, maxLength = 2_048) {
  return (
    value === null ||
    (typeof value === "string" && value.length > 0 && value.length <= maxLength)
  );
}

function validOptionalIsoTimestamp(value) {
  return (
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)))
  );
}

function assertCiEvidence(evidence, state, { current = true } = {}) {
  if (!isRecord(evidence)) throw new Error("The CI evidence is invalid.");
  const { evidenceHash, ...canonical } = evidence;
  if (
    evidence.schema !== "sanctuary-engineering-ci-evidence-v1" ||
    evidence.repository !== "velt-design/sanctuary" ||
    !HASH_PATTERN.test(evidenceHash) ||
    hashJson(canonical) !== evidenceHash ||
    !CI_CLASSIFICATIONS.has(evidence.classification) ||
    !isRecord(evidence.pullRequest) ||
    !Number.isSafeInteger(evidence.pullRequest.number) ||
    evidence.pullRequest.number < 1 ||
    evidence.pullRequest.url !==
      `https://github.com/velt-design/sanctuary/pull/${evidence.pullRequest.number}` ||
    evidence.pullRequest.baseRef !== state.manifest.base.ref ||
    evidence.pullRequest.baseSha !== state.manifest.base.sha ||
    evidence.pullRequest.headRef !== state.manifest.branch ||
    (current && evidence.pullRequest.headSha !== state.completion?.headSha) ||
    (current &&
      evidence.pullRequest.number !== state.completion?.pullRequest?.number) ||
    (current &&
      evidence.pullRequest.url !== state.completion?.pullRequest?.url) ||
    evidence.pullRequest.draft !== true ||
    !Array.isArray(evidence.requiredChecks) ||
    evidence.requiredChecks.length !==
      state.manifest.verification.ciChecks.length
  ) {
    throw new Error(
      "The CI evidence does not match its durable engineering task.",
    );
  }
  evidence.requiredChecks.forEach((check, index) => {
    if (
      !isRecord(check) ||
      check.name !== state.manifest.verification.ciChecks[index] ||
      ![
        "check_run",
        "status_context",
        "workflow_job",
        "workflow_run",
        "missing",
      ].includes(check.kind) ||
      !validOptionalString(check.status, 100) ||
      !validOptionalString(check.conclusion, 100) ||
      !validOptionalString(check.url) ||
      !validOptionalString(check.workflowName, 200) ||
      (check.runId !== null && !/^[1-9][0-9]*$/.test(check.runId)) ||
      !validOptionalIsoTimestamp(check.startedAt) ||
      !validOptionalIsoTimestamp(check.completedAt) ||
      !CI_CHECK_DISPOSITIONS.has(check.disposition) ||
      typeof check.reason !== "string" ||
      !check.reason
    ) {
      throw new Error("The required CI check evidence is invalid.");
    }
  });
  if (
    evidence.classification !==
    expectedCiClassification(evidence.requiredChecks)
  ) {
    throw new Error(
      "The CI classification does not match its required checks.",
    );
  }
}

function assertCiState(ci, state) {
  const missingDispatches = ci?.missingDispatches ?? 0;
  if (
    !isRecord(ci) ||
    !SHA_PATTERN.test(ci.headSha) ||
    !Number.isSafeInteger(ci.startedAt) ||
    !Number.isSafeInteger(ci.deadlineAt) ||
    ci.deadlineAt < ci.startedAt ||
    !Number.isSafeInteger(missingDispatches) ||
    missingDispatches < 0 ||
    missingDispatches > 1 ||
    !Number.isSafeInteger(ci.transientReruns) ||
    ci.transientReruns < 0 ||
    ci.transientReruns > 1 ||
    (ci.evidence !== null && !isRecord(ci.evidence))
  ) {
    throw new Error("The current CI checkpoint is invalid.");
  }
  if (ci.headSha !== state.completion?.headSha) {
    throw new Error("The current CI checkpoint is stale for the worker head.");
  }
  if (ci.evidence !== null) assertCiEvidence(ci.evidence, state);
}

function assertReviewState(review, state) {
  if (
    !isRecord(review) ||
    !REVIEW_STATUSES.has(review.status) ||
    !/^eng_[0-9a-f]{12}_r[0-9a-f]{12}(?:_c[12])?$/.test(review.taskName) ||
    !HASH_PATTERN.test(review.promptHash) ||
    review.headSha !== state.completion?.headSha ||
    review.ciEvidenceHash !== state.ci?.evidence?.evidenceHash ||
    !Number.isSafeInteger(review.budgetCents) ||
    review.budgetCents < 0 ||
    !Number.isSafeInteger(review.startedAt) ||
    !Number.isSafeInteger(review.deadlineAt) ||
    review.deadlineAt < review.startedAt ||
    (review.endedAt !== null &&
      (!Number.isSafeInteger(review.endedAt) ||
        review.endedAt < review.startedAt)) ||
    (review.costCents !== null &&
      (!Number.isSafeInteger(review.costCents) ||
        review.costCents < 0 ||
        review.costCents > review.budgetCents)) ||
    (review.report !== null && !isRecord(review.report))
  ) {
    throw new Error("The independent review checkpoint is invalid.");
  }
  for (const field of ["runId", "taskRunId", "childSessionKey", "error"]) {
    if (review[field] !== null && typeof review[field] !== "string") {
      throw new Error(`Review ${field} is invalid.`);
    }
  }
}

function assertRepairContext(context) {
  if (context === null) return;
  if (
    !isRecord(context) ||
    !["ci_failure", "review_changes"].includes(context.kind) ||
    !HASH_PATTERN.test(context.evidenceHash) ||
    typeof context.summary !== "string" ||
    !context.summary ||
    !Array.isArray(context.findings) ||
    context.findings.some((finding) => typeof finding !== "string" || !finding)
  ) {
    throw new Error("The worker repair context is invalid.");
  }
}

function assertReviewHistoryEntry(entry) {
  if (!isRecord(entry)) {
    throw new Error("The independent review history is invalid.");
  }
  if (isRecord(entry.report)) return;
  if (
    !(
      (entry.kind === "invalid_dispatch_contract" &&
        entry.correction === 1 &&
        /^eng_[0-9a-f]{12}_r[0-9a-f]{12}$/.test(entry.taskName)) ||
      (entry.kind === "missing_registered_review_tool" &&
        entry.correction === 2 &&
        /^eng_[0-9a-f]{12}_r[0-9a-f]{12}_c1$/.test(entry.taskName))
    ) ||
    !HASH_PATTERN.test(entry.promptHash) ||
    !SHA_PATTERN.test(entry.headSha) ||
    !HASH_PATTERN.test(entry.ciEvidenceHash) ||
    !Number.isSafeInteger(entry.budgetCents) ||
    entry.budgetCents < 0 ||
    entry.costCents !== entry.budgetCents ||
    !Number.isSafeInteger(entry.startedAt) ||
    !Number.isSafeInteger(entry.deadlineAt) ||
    entry.deadlineAt < entry.startedAt ||
    !Number.isSafeInteger(entry.endedAt) ||
    entry.endedAt < entry.startedAt ||
    typeof entry.runId !== "string" ||
    typeof entry.taskRunId !== "string" ||
    typeof entry.childSessionKey !== "string" ||
    typeof entry.error !== "string" ||
    !entry.error
  ) {
    throw new Error("The independent review correction history is invalid.");
  }
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
    ci: null,
    ciHistory: [],
    review: null,
    reviewHistory: [],
    repairContext: null,
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
    !Array.isArray(state.attempts) ||
    !Array.isArray(state.ciHistory) ||
    !Array.isArray(state.reviewHistory)
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
    (state.completion !== null && !isRecord(state.completion)) ||
    (state.ci !== null && !isRecord(state.ci)) ||
    (state.review !== null && !isRecord(state.review))
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
  if (state.ci !== null) assertCiState(state.ci, state);
  state.ciHistory.forEach((entry) =>
    assertCiEvidence(entry, state, { current: false }),
  );
  if (state.review !== null) assertReviewState(state.review, state);
  state.reviewHistory.forEach(assertReviewHistoryEntry);
  assertRepairContext(state.repairContext);
  const postWorkerPhases = new Set([
    "ci_pending",
    "reviewer_ready",
    "reviewer_running",
    "awaiting_review",
    "succeeded",
  ]);
  const successfulCompletionPhases = new Set([...postWorkerPhases, "blocked"]);
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
      (state.completion.outcome === "succeeded" &&
        !successfulCompletionPhases.has(state.phase)))
  ) {
    throw new Error("The supervision completion evidence is invalid.");
  }
  if (
    postWorkerPhases.has(state.phase) &&
    (state.completion?.outcome !== "succeeded" || state.ci === null)
  ) {
    throw new Error(
      "Post-worker supervision lacks completion and CI evidence.",
    );
  }
  if (
    state.phase === "blocked" &&
    state.completion?.outcome === "succeeded" &&
    state.ci === null
  ) {
    throw new Error("Blocked post-worker supervision lacks its CI checkpoint.");
  }
  if (
    [
      "reviewer_ready",
      "reviewer_running",
      "awaiting_review",
      "succeeded",
    ].includes(state.phase) &&
    (state.ci?.evidence?.classification !== "passed" || state.review === null)
  ) {
    throw new Error("Independent review started without passed exact-head CI.");
  }
  if (
    state.phase === "succeeded" &&
    (state.review?.status !== "succeeded" ||
      state.review?.report?.verdict !== "approved")
  ) {
    throw new Error(
      "Supervision succeeded without an approved independent review.",
    );
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
    ciClassification: state.ci?.evidence?.classification ?? null,
    ciEvidenceHash: state.ci?.evidence?.evidenceHash ?? null,
    ciMissingDispatches: state.ci?.missingDispatches ?? 0,
    ciTransientReruns: state.ci?.transientReruns ?? 0,
    reviewStatus: state.review?.status ?? null,
    reviewVerdict: state.review?.report?.verdict ?? null,
    repairKind: state.repairContext?.kind ?? null,
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
