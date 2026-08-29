import {
  activeAttempt,
  assertExpectedRevision,
  checkpointState,
  mutation,
  publicSupervision,
  readSupervisionState,
  replaceActiveAttempt,
  timestamp,
} from "./supervision-contract.mjs";
import {
  ENGINEERING_REVIEWER_AGENT,
  TERMINAL_REVIEW_STATUSES,
  assertAttachableReviewerTask,
  assertNativeReviewerIdentity,
  buildReviewDispatch,
  buildLegacyReviewPrompts,
  buildReviewPrompt,
  findNativeReviewMatches,
  validateReviewReport,
} from "./review-runtime.mjs";
import { createReviewCorrectionController } from "./supervision-review-correction.mjs";

const CI_TIMEOUT_MS = 90 * 60 * 1_000;
const REVIEW_PACKET_UPGRADE_SUMMARY =
  "The ready reviewer was upgraded to a bounded exact-diff dispatch envelope.";
const REVIEW_WINDOW_RESTORED_SUMMARY =
  "The upgraded reviewer dispatch window was restored.";
export const POST_WORKER_ACTIVE_PHASES = new Set([
  "ci_pending",
  "reviewer_ready",
  "reviewer_running",
  "awaiting_review",
]);

function sameEvidence(left, right) {
  return left?.evidenceHash && left.evidenceHash === right?.evidenceHash;
}

function reviewerBudget(state) {
  const remaining =
    state.manifest.limits.maxCostCents - state.cumulativeCostCents;
  const futureWorkerAttempts = Math.max(
    0,
    state.manifest.limits.maxAttempts - state.attempts.length,
  );
  return Math.floor(remaining / (futureWorkerAttempts * 2 + 1));
}

function repairSummary(evidence) {
  return evidence.requiredChecks
    .filter((check) => check.disposition === "actionable")
    .map((check) => `${check.name}: ${check.reason}`)
    .join("\n");
}

function reviewFindings(report) {
  return report.findings
    .filter((finding) => finding.severity === "blocking")
    .map(
      (finding) =>
        `${finding.id}: ${finding.summary}${finding.path ? ` (${finding.path}${finding.line ? `:${finding.line}` : ""})` : ""}`,
    );
}

export function createCiReviewController(options) {
  const {
    flowRuntime,
    taskRuns,
    ciRuntime,
    contractAdapter,
    lane,
    repoRoot,
    stateDir,
    now,
    runtimeTimeoutSeconds,
    runtimeConfig,
    getFlow,
    block,
    scheduleWorkerRepair,
  } = options;

  function reviewDispatch(flow, state = readSupervisionState(flow)) {
    return buildReviewDispatch({
      flow,
      state,
      ciRuntime,
      runtimeTimeoutSeconds,
    });
  }

  function awaitCi(flow, state) {
    const at = timestamp(now);
    const nextState = checkpointState(
      {
        ...state,
        ci: {
          headSha: state.completion.headSha,
          startedAt: at,
          deadlineAt: at + CI_TIMEOUT_MS,
          missingDispatches: 0,
          transientReruns: 0,
          evidence: null,
        },
        review: null,
        repairContext: null,
      },
      "ci_pending",
      "The clean draft pull request is published; exact-head required CI is pending.",
      at,
      { phase: "ci_pending" },
    );
    const waiting = mutation(
      flowRuntime.setWaiting({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        currentStep: "ci_pending",
        stateJson: nextState,
        waitJson: {
          kind: "github_checks",
          pullRequest: state.completion.pullRequest.number,
          headSha: state.completion.headSha,
        },
        updatedAt: at,
      }),
      "CI checkpoint",
    );
    return { waiting: true, retryReady: false, ...publicSupervision(waiting) };
  }

  function persistCiWait(flow, state, evidence, summary, patch = {}) {
    const at = timestamp(now);
    const nextState = checkpointState(
      {
        ...state,
        ci: { ...state.ci, ...patch, evidence },
      },
      "ci_pending",
      summary,
      at,
      { phase: "ci_pending" },
    );
    const waiting = mutation(
      flowRuntime.setWaiting({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        currentStep: "ci_pending",
        stateJson: nextState,
        waitJson: {
          kind: "github_checks",
          pullRequest: state.completion.pullRequest.number,
          headSha: state.completion.headSha,
        },
        updatedAt: at,
      }),
      "CI wait",
    );
    return { waiting: true, retryReady: false, ...publicSupervision(waiting) };
  }

  function prepareReviewer(flow, state, evidence) {
    const at = timestamp(now);
    const budgetCents = reviewerBudget(state);
    if (budgetCents < 1) {
      return block(
        flow,
        { ...state, ci: { ...state.ci, evidence } },
        null,
        "review_budget_exhausted",
        "Required CI passed, but no cost budget remains for independent review.",
      );
    }
    const prompt = buildReviewPrompt({
      flowId: flow.flowId,
      state: { ...state, ci: { ...state.ci, evidence } },
      ciEvidence: evidence,
      diff: ciRuntime.diff(evidence),
    });
    let nextState = {
      ...state,
      ci: { ...state.ci, evidence },
      review: {
        status: "ready",
        taskName: `eng_${state.manifestHash.slice(7, 19)}_r${state.completion.headSha.slice(0, 12)}`,
        promptHash: prompt.promptHash,
        headSha: state.completion.headSha,
        ciEvidenceHash: evidence.evidenceHash,
        budgetCents,
        costCents: null,
        startedAt: at,
        deadlineAt: at + runtimeTimeoutSeconds * 1_000,
        endedAt: null,
        runId: null,
        taskRunId: null,
        childSessionKey: null,
        error: null,
        report: null,
      },
    };
    nextState = checkpointState(
      nextState,
      "reviewer_ready",
      "Exact-head required CI passed; the independent reviewer is ready.",
      at,
      { phase: "reviewer_ready" },
    );
    const ready = mutation(
      flowRuntime.resume({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        status: "running",
        currentStep: "reviewer_ready",
        stateJson: nextState,
        updatedAt: at,
      }),
      "Reviewer preparation",
    );
    return reviewDispatch(ready);
  }

  function inspectCi({ flowId, expectedRevision }) {
    const flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    const state = readSupervisionState(flow);
    if (state.phase !== "ci_pending") {
      throw new Error("Only a CI-pending flow can reconcile GitHub checks.");
    }
    const evidence = ciRuntime.inspect({
      manifest: state.manifest,
      completion: state.completion,
    });
    if (evidence.classification === "pending") {
      if (timestamp(now) > state.ci.deadlineAt) {
        return block(
          flow,
          { ...state, ci: { ...state.ci, evidence } },
          null,
          "ci_timeout",
          "Required CI did not reach a safe terminal state within 90 minutes.",
        );
      }
      if (
        (state.ci.missingDispatches ?? 0) < 1 &&
        evidence.requiredChecks.length > 0 &&
        evidence.requiredChecks.every((check) => check.kind === "missing")
      ) {
        const dispatch = ciRuntime.dispatchMissing({
          manifest: state.manifest,
          completion: state.completion,
          evidence,
        });
        if (dispatch) {
          return {
            dispatchRequested: true,
            dispatch,
            ...persistCiWait(
              flow,
              state,
              evidence,
              "One exact-head workflow dispatch was requested for missing required CI.",
              { missingDispatches: 1 },
            ),
          };
        }
      }
      if (sameEvidence(state.ci.evidence, evidence)) {
        return { waiting: true, unchanged: true, ...publicSupervision(flow) };
      }
      return persistCiWait(
        flow,
        state,
        evidence,
        "Required exact-head CI is still pending.",
      );
    }
    if (evidence.classification === "transient") {
      if (state.ci.transientReruns >= 1) {
        if (
          sameEvidence(state.ci.evidence, evidence) &&
          timestamp(now) <= state.ci.deadlineAt
        ) {
          return { waiting: true, unchanged: true, ...publicSupervision(flow) };
        }
        return block(
          flow,
          { ...state, ci: { ...state.ci, evidence } },
          null,
          "ci_transient_rerun_exhausted",
          "The one exact-head transient CI rerun was already used.",
        );
      }
      const runIds = ciRuntime.rerunTransient(evidence);
      return {
        rerunRequested: true,
        rerunRunIds: runIds,
        ...persistCiWait(
          flow,
          state,
          evidence,
          "One bounded failed-job workflow rerun was requested for transient CI evidence.",
          { transientReruns: 1 },
        ),
      };
    }
    if (evidence.classification === "repair_required") {
      const summary = repairSummary(evidence);
      return scheduleWorkerRepair(flow, state, {
        kind: "ci_failure",
        evidenceHash: evidence.evidenceHash,
        summary,
        findings: evidence.requiredChecks
          .filter((check) => check.disposition === "actionable")
          .map((check) => check.name),
        ciEvidence: evidence,
      });
    }
    if (evidence.classification === "blocked") {
      return block(
        flow,
        { ...state, ci: { ...state.ci, evidence } },
        null,
        "ci_unclassified_terminal",
        "A required check was skipped, neutral, duplicated or otherwise unsafe to classify.",
      );
    }
    return prepareReviewer(flow, state, evidence);
  }

  function attachReview({ flowId, expectedRevision, runId }) {
    let flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    let state = readSupervisionState(flow);
    if (state.phase !== "reviewer_ready") {
      throw new Error(
        "Only a ready independent reviewer can attach a native task.",
      );
    }
    const dispatch = reviewDispatch(flow, state);
    const nativeMatches = findNativeReviewMatches(taskRuns, dispatch).filter(
      (task) => task.runId === runId,
    );
    if (nativeMatches.length !== 1) {
      throw new Error(
        "The run ID does not identify exactly one named Sanctuary code reviewer.",
      );
    }
    const task = assertAttachableReviewerTask({
      task: nativeMatches[0],
      runId,
      expectedDispatch: dispatch,
      review: state.review,
      supervisorSessionKey: taskRuns.sessionKey,
    });
    const at = timestamp(now);
    state = checkpointState(
      {
        ...state,
        review: {
          ...state.review,
          status: task.status,
          runId,
          taskRunId: task.id,
          childSessionKey: task.childSessionKey,
          endedAt: TERMINAL_REVIEW_STATUSES.has(task.status)
            ? (task.endedAt ?? at)
            : null,
        },
      },
      "reviewer_attached",
      `The independent review is bound to native task ${task.id}.`,
      at,
      { phase: "reviewer_running" },
    );
    flow = mutation(
      flowRuntime.resume({
        flowId,
        expectedRevision,
        status: "running",
        currentStep: "reviewer_running",
        stateJson: state,
        updatedAt: at,
      }),
      "Reviewer attachment",
    );
    return publicSupervision(flow);
  }

  function chargeReview(state, costCents) {
    const attempt = activeAttempt(state);
    const cumulativeCostCents = state.cumulativeCostCents + costCents;
    if (cumulativeCostCents > state.manifest.limits.maxCostCents) {
      throw new Error(
        "The independent review exceeded the manifest cost limit.",
      );
    }
    return {
      ...replaceActiveAttempt(state, attempt, { cumulativeCostCents }),
      cumulativeCostCents,
    };
  }

  const reviewCorrection = createReviewCorrectionController({
    flowRuntime,
    taskRuns,
    ciRuntime,
    now,
    runtimeTimeoutSeconds,
    getFlow,
    reviewDispatch,
    reviewerBudget,
    chargeReview,
  });

  function reserveAndBlock(flow, state, task, kind, summary) {
    const at = timestamp(now);
    state = chargeReview(state, state.review.budgetCents);
    state = {
      ...state,
      review: {
        ...state.review,
        status: task?.status ?? "blocked",
        costCents: state.review.budgetCents,
        endedAt: task?.endedAt ?? at,
        error: summary,
      },
    };
    return block(flow, state, task, kind, summary);
  }

  async function reconcileReview({ flowId, expectedRevision, report }) {
    let flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    let state = readSupervisionState(flow);
    if (!["reviewer_running", "awaiting_review"].includes(state.phase)) {
      throw new Error(
        "The flow has no attached independent reviewer to reconcile.",
      );
    }
    const task = assertNativeReviewerIdentity(
      taskRuns.get(state.review.taskRunId),
      state.review,
      taskRuns.sessionKey,
    );
    if (["queued", "running"].includes(task.status)) {
      if (timestamp(now) <= state.review.deadlineAt) {
        return { waiting: true, retryReady: false, ...publicSupervision(flow) };
      }
      if (!runtimeConfig) {
        return reserveAndBlock(
          flow,
          state,
          task,
          "review_timeout_cancel_unavailable",
          "The reviewer exceeded its deadline and safe cancellation is unavailable.",
        );
      }
      const cancelled = await taskRuns.cancel({
        taskId: task.id,
        cfg: runtimeConfig,
      });
      if (!cancelled?.cancelled) {
        return reserveAndBlock(
          flow,
          state,
          task,
          "review_timeout_cancel_failed",
          cancelled?.reason ?? "The overdue reviewer could not be cancelled.",
        );
      }
      return reserveAndBlock(
        flow,
        state,
        cancelled.task ?? task,
        "review_timed_out",
        "The independent reviewer timed out; automatic reviewer replacement is prohibited.",
      );
    }
    if (!TERMINAL_REVIEW_STATUSES.has(task.status)) {
      throw new Error(
        "The native reviewer returned an unknown lifecycle state.",
      );
    }
    if (task.status !== "succeeded") {
      return reserveAndBlock(
        flow,
        state,
        task,
        `native_review_${task.status}`,
        task.error ?? `The independent reviewer ended ${task.status}.`,
      );
    }
    if (!report) {
      if (state.phase === "awaiting_review") {
        return { waiting: true, retryReady: false, ...publicSupervision(flow) };
      }
      const at = timestamp(now);
      state = checkpointState(
        {
          ...state,
          review: {
            ...state.review,
            status: "succeeded",
            endedAt: task.endedAt ?? at,
          },
        },
        "awaiting_review",
        "The native reviewer succeeded; strict review evidence is required.",
        at,
        { phase: "awaiting_review" },
      );
      flow = mutation(
        flowRuntime.setWaiting({
          flowId,
          expectedRevision,
          currentStep: "awaiting_review",
          stateJson: state,
          waitJson: { kind: "review_evidence", runId: task.runId },
          updatedAt: at,
        }),
        "Review evidence checkpoint",
      );
      return { waiting: true, retryReady: false, ...publicSupervision(flow) };
    }
    const evidence = validateReviewReport({
      contractAdapter,
      lane,
      repoRoot,
      stateDir,
      state,
      task,
      reportInput: report,
    });
    const at = timestamp(now);
    state = chargeReview(state, report.reviewer.costCents);
    state = {
      ...state,
      review: {
        ...state.review,
        status:
          report.verdict === "approved"
            ? "succeeded"
            : report.verdict === "changes_requested"
              ? "changes_requested"
              : "blocked",
        costCents: report.reviewer.costCents,
        endedAt: task.endedAt ?? at,
        error: report.verdict === "approved" ? null : report.nextAction,
        report: evidence.report,
      },
    };
    if (report.verdict === "approved") {
      state = checkpointState(
        state,
        "completed",
        "Exact-head CI and independent read-only review both passed.",
        at,
        { phase: "succeeded" },
      );
      const finished = mutation(
        flowRuntime.finish({
          flowId,
          expectedRevision,
          currentStep: "succeeded",
          stateJson: state,
          updatedAt: at,
          endedAt: at,
        }),
        "Reviewed flow completion",
      );
      return {
        waiting: false,
        retryReady: false,
        ...publicSupervision(finished),
      };
    }
    if (report.verdict === "changes_requested") {
      return scheduleWorkerRepair(flow, state, {
        kind: "review_changes",
        evidenceHash: state.ci.evidence.evidenceHash,
        summary: report.nextAction,
        findings: reviewFindings(report),
        ciEvidence: state.ci.evidence,
        reviewEvidence: state.review,
      });
    }
    return block(flow, state, task, "review_blocked", report.nextAction);
  }

  function resumeReview(flow) {
    let state = readSupervisionState(flow);
    const diff = ciRuntime.diff(state.ci.evidence);
    const currentPrompt = buildReviewPrompt({
      flowId: flow.flowId,
      state,
      ciEvidence: state.ci.evidence,
      diff,
    });
    if (state.review.promptHash !== currentPrompt.promptHash) {
      const legacyPrompts = buildLegacyReviewPrompts({
        flowId: flow.flowId,
        state,
        ciEvidence: state.ci.evidence,
        diff,
      });
      if (
        !legacyPrompts.some(
          (legacyPrompt) => state.review.promptHash === legacyPrompt.promptHash,
        )
      ) {
        throw new Error(
          "The independent review prompt no longer matches its durable hash.",
        );
      }
      const at = timestamp(now);
      const nextState = checkpointState(
        {
          ...state,
          review: {
            ...state.review,
            promptHash: currentPrompt.promptHash,
            startedAt: at,
            deadlineAt: at + runtimeTimeoutSeconds * 1_000,
          },
        },
        "reviewer_ready",
        REVIEW_PACKET_UPGRADE_SUMMARY,
        at,
        { phase: "reviewer_ready" },
      );
      flow = mutation(
        flowRuntime.resume({
          flowId: flow.flowId,
          expectedRevision: flow.revision,
          status: "running",
          currentStep: "reviewer_ready",
          stateJson: nextState,
          updatedAt: at,
        }),
        "Reviewer packet upgrade",
      );
      state = readSupervisionState(flow);
    }
    if (
      state.review.promptHash === currentPrompt.promptHash &&
      state.review.status === "ready" &&
      state.review.runId === null &&
      state.lastCheckpoint?.kind === "reviewer_ready" &&
      state.lastCheckpoint.summary === REVIEW_PACKET_UPGRADE_SUMMARY &&
      Number.isSafeInteger(state.lastCheckpoint.at) &&
      state.review.deadlineAt < state.lastCheckpoint.at
    ) {
      const startedAt = state.lastCheckpoint.at;
      const at = timestamp(now);
      const nextState = checkpointState(
        {
          ...state,
          review: {
            ...state.review,
            startedAt,
            deadlineAt: at + runtimeTimeoutSeconds * 1_000,
          },
        },
        "reviewer_ready",
        REVIEW_WINDOW_RESTORED_SUMMARY,
        at,
        { phase: "reviewer_ready" },
      );
      flow = mutation(
        flowRuntime.resume({
          flowId: flow.flowId,
          expectedRevision: flow.revision,
          status: "running",
          currentStep: "reviewer_ready",
          stateJson: nextState,
          updatedAt: at,
        }),
        "Reviewer dispatch window restoration",
      );
      state = readSupervisionState(flow);
    }
    const dispatch = reviewDispatch(flow, state);
    const matches = findNativeReviewMatches(taskRuns, dispatch);
    if (matches.length === 0) return dispatch;
    if (matches.length > 1) {
      return block(
        flow,
        state,
        null,
        "duplicate_native_reviewer",
        "More than one native reviewer matches the durable review dispatch.",
      );
    }
    return {
      recoveredAttached: true,
      ...attachReview({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
        runId: matches[0].runId,
      }),
    };
  }

  async function recover(flow) {
    const state = readSupervisionState(flow);
    if (state.phase === "ci_pending") {
      return inspectCi({
        flowId: flow.flowId,
        expectedRevision: flow.revision,
      });
    }
    if (state.phase === "reviewer_ready") return resumeReview(flow);
    return reconcileReview({
      flowId: flow.flowId,
      expectedRevision: flow.revision,
    });
  }

  return Object.freeze({
    awaitCi,
    inspectCi,
    attachReview,
    reconcileReview,
    redispatchReview: reviewCorrection.redispatchReview,
    recover,
  });
}
