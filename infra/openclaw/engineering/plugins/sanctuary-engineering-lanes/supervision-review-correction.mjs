import {
  assertExpectedRevision,
  checkpointState,
  mutation,
  readSupervisionState,
  timestamp,
} from "./supervision-contract.mjs";
import {
  assertNativeReviewerIdentity,
  buildLegacyChunkedReviewPrompt,
  buildReviewPrompt,
} from "./review-runtime.mjs";

export function createReviewCorrectionController(options) {
  const {
    flowRuntime,
    taskRuns,
    ciRuntime,
    now,
    runtimeTimeoutSeconds,
    getFlow,
    reviewDispatch,
    reviewerBudget,
    chargeReview,
  } = options;

  function redispatchReview({ flowId, expectedRevision, priorRunId, reason }) {
    let flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    let state = readSupervisionState(flow);
    if (reason !== "invalid_dispatch_contract") {
      throw new Error("The reviewer correction reason is invalid.");
    }
    if (!["reviewer_running", "awaiting_review"].includes(state.phase)) {
      throw new Error(
        "Only an attached reviewer with invalid dispatch evidence can be corrected.",
      );
    }
    if (
      state.review.report !== null ||
      state.review.runId !== priorRunId ||
      state.reviewHistory.some(
        (entry) => entry.kind === "invalid_dispatch_contract",
      )
    ) {
      throw new Error(
        "The one recorded reviewer dispatch correction is not available.",
      );
    }
    const task = assertNativeReviewerIdentity(
      taskRuns.get(state.review.taskRunId),
      state.review,
      taskRuns.sessionKey,
    );
    if (task.status !== "succeeded" || !Number.isSafeInteger(task.endedAt)) {
      throw new Error(
        "The invalid reviewer dispatch must have one completed native task.",
      );
    }
    const diff = ciRuntime.diff(state.ci.evidence);
    const invalidPrompt = buildLegacyChunkedReviewPrompt({
      flowId,
      state,
      ciEvidence: state.ci.evidence,
      diff,
    });
    if (invalidPrompt.promptHash !== state.review.promptHash) {
      throw new Error(
        "The attached reviewer was not created from the recognized invalid dispatch contract.",
      );
    }

    const at = timestamp(now);
    const priorReview = state.review;
    state = chargeReview(state, priorReview.budgetCents);
    const budgetCents = reviewerBudget(state);
    if (budgetCents < 1) {
      throw new Error(
        "No cost budget remains for the recorded reviewer correction.",
      );
    }
    const currentPrompt = buildReviewPrompt({
      flowId,
      state,
      ciEvidence: state.ci.evidence,
      diff,
    });
    state = checkpointState(
      {
        ...state,
        reviewHistory: [
          ...state.reviewHistory,
          {
            kind: "invalid_dispatch_contract",
            correction: 1,
            taskName: priorReview.taskName,
            promptHash: priorReview.promptHash,
            headSha: priorReview.headSha,
            ciEvidenceHash: priorReview.ciEvidenceHash,
            budgetCents: priorReview.budgetCents,
            costCents: priorReview.budgetCents,
            startedAt: priorReview.startedAt,
            deadlineAt: priorReview.deadlineAt,
            endedAt: task.endedAt,
            runId: priorReview.runId,
            taskRunId: priorReview.taskRunId,
            childSessionKey: priorReview.childSessionKey,
            error:
              "The reviewer inherited an incomplete tool allowlist and returned evidence outside the strict review schema.",
          },
        ],
        review: {
          status: "ready",
          taskName: `${priorReview.taskName}_c1`,
          promptHash: currentPrompt.promptHash,
          headSha: priorReview.headSha,
          ciEvidenceHash: priorReview.ciEvidenceHash,
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
      },
      "reviewer_correction_ready",
      "One operator-authorized reviewer correction was recorded; a strict exact-diff review is ready.",
      at,
      { phase: "reviewer_ready" },
    );
    flow = mutation(
      flowRuntime.resume({
        flowId,
        expectedRevision,
        status: "running",
        currentStep: "reviewer_ready",
        stateJson: state,
        updatedAt: at,
      }),
      "Reviewer dispatch correction",
    );
    return reviewDispatch(flow);
  }

  return Object.freeze({ redispatchReview });
}
