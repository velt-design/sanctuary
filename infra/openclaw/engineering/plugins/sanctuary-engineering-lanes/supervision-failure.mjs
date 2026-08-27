import {
  activeAttempt,
  checkpointState,
  mutation,
  publicSupervision,
  replaceActiveAttempt,
  timestamp,
} from "./supervision-contract.mjs";

export function createSupervisionFailureController({
  flowRuntime,
  taskRuns,
  now,
}) {
  function scheduleRetry(flow, state, task, status, reason) {
    const at = timestamp(now);
    const attempt = activeAttempt(state);
    const cumulativeCostCents = ["timed_out", "lost"].includes(status)
      ? Math.min(
          state.manifest.limits.maxCostCents,
          state.cumulativeCostCents + attempt.budgetCents,
        )
      : state.cumulativeCostCents;
    state = replaceActiveAttempt(state, attempt, {
      status,
      endedAt: task?.endedAt ?? at,
      error: reason,
      cumulativeCostCents,
    });
    state = { ...state, cumulativeCostCents };
    const costBudgetExhausted =
      state.cumulativeCostCents >= state.manifest.limits.maxCostCents;
    if (
      state.attempts.length >= state.manifest.limits.maxAttempts ||
      costBudgetExhausted
    ) {
      const limit = costBudgetExhausted ? "cost budget" : "attempt limit";
      state = checkpointState(
        state,
        costBudgetExhausted ? "cost_budget_exhausted" : "attempts_exhausted",
        `The ${limit} was reached after ${status}.`,
        at,
        { phase: "failed" },
      );
      const failed = mutation(
        flowRuntime.fail({
          flowId: flow.flowId,
          expectedRevision: flow.revision,
          stateJson: state,
          blockedTaskId: task?.id ?? null,
          blockedSummary: reason,
          updatedAt: at,
          endedAt: at,
        }),
        "Attempt exhaustion",
      );
      return { retryReady: false, ...publicSupervision(failed) };
    }
    state = checkpointState(
      state,
      "retry_ready",
      `Attempt ${attempt.number} ended ${status}; one bounded same-lane retry is ready.`,
      at,
      { phase: "retry_ready" },
    );
    const queued = mutation(
      flowRuntime.resume({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        status: "queued",
        currentStep: "retry_ready",
        stateJson: state,
        updatedAt: at,
      }),
      "Retry checkpoint",
    );
    return { retryReady: true, ...publicSupervision(queued) };
  }

  function block(flow, state, task, kind, summary) {
    const at = timestamp(now);
    state = checkpointState(state, kind, summary, at, { phase: "blocked" });
    const blocked = mutation(
      flowRuntime.setWaiting({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        currentStep: "blocked",
        stateJson: state,
        waitJson: { kind: "operator_attention" },
        blockedTaskId: task?.id ?? null,
        blockedSummary: summary,
        updatedAt: at,
      }),
      "Blocked checkpoint",
    );
    return { retryReady: false, ...publicSupervision(blocked) };
  }

  function scheduleWorkerRepair(flow, state, context) {
    const attempt = activeAttempt(state);
    const task = taskRuns.resolve(attempt.runId);
    const ciHistory = context.ciEvidence
      ? [...state.ciHistory, context.ciEvidence]
      : state.ciHistory;
    const reviewHistory = context.reviewEvidence
      ? [
          ...state.reviewHistory,
          {
            headSha: context.reviewEvidence.headSha,
            ciEvidenceHash: context.reviewEvidence.ciEvidenceHash,
            report: context.reviewEvidence.report,
          },
        ]
      : state.reviewHistory;
    const repairState = {
      ...state,
      completion: null,
      ci: null,
      ciHistory,
      review: null,
      reviewHistory,
      repairContext: {
        kind: context.kind,
        evidenceHash: context.evidenceHash,
        summary: context.summary,
        findings: context.findings,
      },
    };
    return {
      repairReady: true,
      ...scheduleRetry(flow, repairState, task, "failed", context.summary),
    };
  }

  return Object.freeze({ block, scheduleRetry, scheduleWorkerRepair });
}
