import { activeAttempt, cloneJson } from "./supervision-contract.mjs";

function sameStrings(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    [...left].sort().join("\n") === [...right].sort().join("\n")
  );
}

export function assertNativeTaskIdentity(task, attempt, workerAgentId) {
  if (
    !task ||
    task.runId !== attempt.runId ||
    task.id !== attempt.taskRunId ||
    task.runtime !== "subagent" ||
    task.agentId !== workerAgentId ||
    task.label !== attempt.taskName ||
    task.childSessionKey !== attempt.childSessionKey
  ) {
    throw new Error("The native OpenClaw task no longer matches its attempt.");
  }
  return task;
}

export function validateSupervisionCompletion({
  contractAdapter,
  lane,
  repoRoot,
  stateDir,
  state,
  task,
  completionInput,
}) {
  if (
    !Array.isArray(completionInput?.worker?.sessionIds) ||
    completionInput.worker.sessionIds.length !== 1 ||
    completionInput.worker.sessionIds[0] !== "controller_bound" ||
    completionInput.worker.startedAt !== "controller_bound" ||
    completionInput.worker.completedAt !== "controller_bound"
  ) {
    throw new Error(
      "The completion report did not request controller-bound native evidence.",
    );
  }
  if (
    !Number.isSafeInteger(task.createdAt) ||
    !Number.isSafeInteger(task.endedAt) ||
    task.endedAt < task.createdAt
  ) {
    throw new Error("The native worker timestamps are incomplete or invalid.");
  }
  const completion = contractAdapter.validateCompletion(
    {
      ...completionInput,
      worker: {
        ...completionInput.worker,
        sessionIds: [task.childSessionKey],
        startedAt: new Date(task.createdAt).toISOString(),
        completedAt: new Date(task.endedAt).toISOString(),
      },
    },
    {
      repoRoot,
      stateDir,
    },
  );
  const attempt = activeAttempt(state);
  if (
    completion.taskId !== state.taskId ||
    completion.manifestHash !== state.manifestHash ||
    completion.branch !== state.manifest.branch ||
    completion.baseSha !== state.manifest.base.sha ||
    completion.worker.attempts !== attempt.number ||
    completion.worker.costCents < state.cumulativeCostCents ||
    completion.worker.costCents - state.cumulativeCostCents >
      attempt.budgetCents ||
    completion.worker.costCents > state.manifest.limits.maxCostCents ||
    !completion.worker.sessionIds.includes(task.childSessionKey) ||
    !sameStrings(
      completion.ciChecks.map((check) => check.name),
      state.manifest.verification.ciChecks,
    )
  ) {
    throw new Error(
      "The completion report does not match its flow and attempt.",
    );
  }
  const laneStatus = lane.status(state.taskId, state.manifestHash);
  if (
    laneStatus.branch !== state.manifest.branch ||
    laneStatus.baseSha !== state.manifest.base.sha ||
    laneStatus.worktreePath !== attempt.worktreePath
  ) {
    throw new Error("The completion report no longer matches its owned lane.");
  }
  if (completion.outcome === "succeeded") {
    if (
      laneStatus.state !== "published" ||
      laneStatus.clean !== true ||
      laneStatus.headSha !== completion.headSha ||
      laneStatus.pullRequest?.number !== completion.pullRequest?.number ||
      laneStatus.pullRequest?.url !== completion.pullRequest?.url ||
      laneStatus.pullRequest?.draft !== true ||
      !sameStrings(laneStatus.changedPaths, completion.changedPaths)
    ) {
      throw new Error("Successful completion lacks exact live lane evidence.");
    }
  }
  return { completion: cloneJson(completion), laneStatus };
}
