import {
  ENGINEERING_SUPERVISOR_AGENT,
  activeAttempt,
} from "./supervision-contract.mjs";

export const TERMINAL_NATIVE_STATUSES = new Set([
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "lost",
]);

const NATIVE_STATUSES = new Set([
  "queued",
  "running",
  ...TERMINAL_NATIVE_STATUSES,
]);

export function buildWorkerDispatch({
  flow,
  state,
  laneResult,
  runtimeTimeoutSeconds,
  workerAgentId,
}) {
  const attempt = activeAttempt(state);
  if (!attempt || attempt.status !== "ready") {
    throw new Error("The flow does not have a dispatchable attempt.");
  }
  if (laneResult.worktreePath !== attempt.worktreePath) {
    throw new Error(
      "The resumed lane path does not match its durable attempt.",
    );
  }
  const retryContext =
    attempt.number === 1
      ? ""
      : `\n\n# Recovery attempt\n\nThis is bounded attempt ${attempt.number} of ${state.manifest.limits.maxAttempts}. Resume the existing exact lane, inspect prior work and evidence first, and do not restart the task from scratch.\n`;
  const attemptEnvelope = `\n\n# Attempt envelope\n\nThis is attempt ${attempt.number} of ${state.manifest.limits.maxAttempts}. The previously reported cumulative task cost is ${state.cumulativeCostCents} cents. This attempt may add at most ${attempt.budgetCents} cents. In the completion report, worker.costCents must be the new cumulative task total, not only this attempt's cost. Set worker.sessionIds to exactly ["controller_bound"] and both worker.startedAt and worker.completedAt to "controller_bound"; the controller replaces those sentinels with verified native evidence.\n`;
  const repairContext = state.repairContext
    ? `\n\n# Required repair evidence\n\nThis is a bounded ${state.repairContext.kind === "ci_failure" ? "CI repair" : "review repair"}. Diagnose and address only the evidence below in the existing lane. Do not suppress, skip, weaken or rename a check. If the evidence is not reproducible or cannot be safely repaired in scope, return a blocked completion instead of creating a meaningless commit.\n\n\`\`\`json\n${JSON.stringify(state.repairContext, null, 2)}\n\`\`\`\n`
    : "";
  const workerPrompt =
    `${laneResult.workerPrompt}${attemptEnvelope}${retryContext}${repairContext}`.trim();
  return {
    claimed: true,
    flowId: flow.flowId,
    expectedRevision: flow.revision,
    taskId: state.taskId,
    manifestHash: state.manifestHash,
    attempt: attempt.number,
    maxAttempts: state.manifest.limits.maxAttempts,
    workerAgentId,
    dispatchKey: attempt.dispatchKey,
    taskName: attempt.taskName,
    worktreePath: laneResult.worktreePath,
    runTimeoutSeconds: runtimeTimeoutSeconds,
    attemptStartedAt: attempt.startedAt,
    attemptDeadlineAt: attempt.deadlineAt,
    priorCumulativeCostCents: state.cumulativeCostCents,
    attemptBudgetCents: attempt.budgetCents,
    workerPrompt,
  };
}

export function findNativeDispatchMatches(taskRuns, workerDispatch) {
  return taskRuns
    .list()
    .filter(
      (task) =>
        task.runtime === "subagent" &&
        task.agentId === workerDispatch.workerAgentId &&
        task.requesterAgentId === ENGINEERING_SUPERVISOR_AGENT &&
        task.task === workerDispatch.workerPrompt &&
        Number.isSafeInteger(task.createdAt) &&
        task.createdAt >= workerDispatch.attemptStartedAt &&
        task.createdAt <= workerDispatch.attemptDeadlineAt,
    );
}

export function assertAttachableNativeTask({
  task,
  runId,
  expectedDispatch,
  attempt,
}) {
  if (
    !task ||
    task.runId !== runId ||
    task.runtime !== "subagent" ||
    task.agentId !== expectedDispatch.workerAgentId ||
    task.requesterAgentId !== ENGINEERING_SUPERVISOR_AGENT ||
    task.task !== expectedDispatch.workerPrompt ||
    !task.childSessionKey ||
    !NATIVE_STATUSES.has(task.status) ||
    !Number.isSafeInteger(task.createdAt) ||
    task.createdAt < attempt.startedAt ||
    task.createdAt > attempt.deadlineAt
  ) {
    throw new Error(
      "The native task is not the named Sanctuary coding worker.",
    );
  }
  return task;
}
