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

const REVIEW_CORRECTIONS = Object.freeze({
  invalid_dispatch_contract: Object.freeze({
    number: 1,
    priorReason: null,
    error:
      "The reviewer inherited an incomplete tool allowlist and returned evidence outside the strict review schema.",
  }),
  missing_registered_review_tool: Object.freeze({
    number: 2,
    priorReason: "invalid_dispatch_contract",
    error:
      "The strict reviewer output proved that the diff reader was configured but not registered on the spawning supervisor for child inheritance.",
  }),
});

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
    const correction = REVIEW_CORRECTIONS[reason];
    if (!correction) {
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
      state.reviewHistory.some((entry) => entry.kind === reason)
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
    const baseTaskName = `eng_${state.manifestHash.slice(7, 19)}_r${state.completion.headSha.slice(0, 12)}`;
    const expectedTaskName =
      correction.number === 1
        ? baseTaskName
        : `${baseTaskName}_c${correction.number - 1}`;
    if (
      state.review.taskName !== expectedTaskName ||
      (correction.priorReason !== null &&
        !state.reviewHistory.some(
          (entry) => entry.kind === correction.priorReason,
        ))
    ) {
      throw new Error(
        "The reviewer correction does not match the durable correction sequence.",
      );
    }
    const recognizedPrompt = (
      correction.number === 1
        ? buildLegacyChunkedReviewPrompt
        : buildReviewPrompt
    )({
      flowId,
      state,
      ciEvidence: state.ci.evidence,
      diff,
    });
    if (recognizedPrompt.promptHash !== state.review.promptHash) {
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
            kind: reason,
            correction: correction.number,
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
            error: correction.error,
          },
        ],
        review: {
          status: "ready",
          taskName: `${baseTaskName}_c${correction.number}`,
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
      `Operator-authorized reviewer correction ${correction.number} was recorded; a strict exact-diff review is ready.`,
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
