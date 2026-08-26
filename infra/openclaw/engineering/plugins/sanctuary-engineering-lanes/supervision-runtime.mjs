import {
  defaultContractAdapter,
  assertTaskIdentity,
} from "./lane-contract.mjs";
import {
  provisionEngineeringLane,
  statusEngineeringLane,
} from "./lane-runtime.mjs";
import {
  ENGINEERING_SUPERVISION_CONTROLLER,
  ENGINEERING_WORKER_AGENT,
  activeAttempt,
  assertExpectedRevision,
  checkpointState,
  createSupervisionState,
  isSupervisionFlow,
  mutation,
  publicSupervision,
  readSupervisionState,
  replaceActiveAttempt,
  required,
  timestamp,
} from "./supervision-contract.mjs";
import {
  assertNativeTaskIdentity,
  validateSupervisionCompletion,
} from "./supervision-evidence.mjs";
import {
  TERMINAL_NATIVE_STATUSES,
  assertAttachableNativeTask,
  buildWorkerDispatch,
  findNativeDispatchMatches,
} from "./supervision-dispatch.mjs";
import { createGitHubCiRuntime } from "./ci-runtime.mjs";
import {
  POST_WORKER_ACTIVE_PHASES,
  createCiReviewController,
} from "./supervision-ci-review.mjs";
import { createSupervisionFailureController } from "./supervision-failure.mjs";

const ACTIVE_PHASES = new Set([
  "worker_ready",
  "worker_running",
  "awaiting_completion",
  ...POST_WORKER_ACTIVE_PHASES,
]);
export function createEngineeringSupervisionController(options = {}) {
  const flowRuntime = required(options.flowRuntime, "Task Flow runtime");
  const taskRuns = required(options.taskRuns, "Task Run runtime");
  const repoRoot =
    options.repoRoot ?? process.env.SANCTUARY_ENGINEERING_REPO_ROOT;
  const stateDir = options.stateDir ?? process.env.OPENCLAW_STATE_DIR;
  required(repoRoot, "SANCTUARY_ENGINEERING_REPO_ROOT");
  required(stateDir, "OPENCLAW_STATE_DIR");
  const contractAdapter = options.contractAdapter ?? defaultContractAdapter;
  const lane = options.laneRuntime ?? {
    provision: (manifest) => provisionEngineeringLane(manifest),
    status: (taskId, manifestHash) =>
      statusEngineeringLane(taskId, manifestHash),
  };
  const now = options.now ?? (() => Date.now());
  const runtimeConfig = options.runtimeConfig;
  const runtimeTimeoutSeconds =
    options.runtimeTimeoutSeconds ??
    runtimeConfig?.agents?.defaults?.subagents?.runTimeoutSeconds;
  let defaultCiRuntime = null;
  const ciRuntime =
    options.ciRuntime ??
    Object.freeze({
      inspect(input) {
        defaultCiRuntime ??= createGitHubCiRuntime({ repoRoot, stateDir });
        return defaultCiRuntime.inspect(input);
      },
      diff(input) {
        defaultCiRuntime ??= createGitHubCiRuntime({ repoRoot, stateDir });
        return defaultCiRuntime.diff(input);
      },
      rerunTransient(input) {
        defaultCiRuntime ??= createGitHubCiRuntime({ repoRoot, stateDir });
        return defaultCiRuntime.rerunTransient(input);
      },
    });
  const { block, scheduleRetry, scheduleWorkerRepair } =
    createSupervisionFailureController({ flowRuntime, taskRuns, now });

  function resolveManifest(manifest) {
    const resolved = contractAdapter.resolve(manifest, { repoRoot, stateDir });
    if (
      !Number.isSafeInteger(runtimeTimeoutSeconds) ||
      runtimeTimeoutSeconds <= 0 ||
      resolved.manifest.limits.workerTimeoutMinutes * 60 !==
        runtimeTimeoutSeconds
    ) {
      throw new Error(
        "The manifest worker timeout must match the pinned OpenClaw subagent timeout.",
      );
    }
    return resolved;
  }

  function supervisionFlows() {
    return flowRuntime.list().filter(isSupervisionFlow).map(validateStoredFlow);
  }

  function validateStoredFlow(flow) {
    const state = readSupervisionState(flow);
    const resolved = resolveManifest(state.manifest);
    if (
      resolved.manifestHash !== state.manifestHash ||
      JSON.stringify(resolved.manifest) !== JSON.stringify(state.manifest)
    ) {
      throw new Error("A durable flow manifest failed canonical validation.");
    }
    if (state.completion !== null) {
      const completion = contractAdapter.validateCompletion(state.completion, {
        repoRoot,
        stateDir,
      });
      if (JSON.stringify(completion) !== JSON.stringify(state.completion)) {
        throw new Error(
          "Durable completion evidence failed canonical validation.",
        );
      }
    }
    const storedReviews = [
      ...(state.review?.report ? [state.review.report] : []),
      ...state.reviewHistory.map((entry) => entry.report),
    ];
    for (const storedReview of storedReviews) {
      const review = contractAdapter.validateReview(storedReview, {
        repoRoot,
        stateDir,
      });
      if (JSON.stringify(review) !== JSON.stringify(storedReview)) {
        throw new Error("Durable review evidence failed canonical validation.");
      }
    }
    return flow;
  }

  function getFlow(flowId) {
    const flow = flowRuntime.get(flowId);
    if (!isSupervisionFlow(flow)) {
      throw new Error(
        "The requested Sanctuary supervision flow does not exist.",
      );
    }
    return validateStoredFlow(flow);
  }

  function findTaskFlow(taskId, manifestHash) {
    assertTaskIdentity(taskId, manifestHash);
    const matches = supervisionFlows().filter((flow) => {
      const state = readSupervisionState(flow);
      return state.taskId === taskId;
    });
    if (matches.length > 1) {
      throw new Error("More than one supervision flow owns this task id.");
    }
    const flow = matches[0];
    if (!flow) throw new Error("The engineering task is not enqueued.");
    if (readSupervisionState(flow).manifestHash !== manifestHash) {
      throw new Error("The task id is already bound to another manifest.");
    }
    return flow;
  }

  function enqueue(manifestInput) {
    const { manifest, manifestHash } = resolveManifest(manifestInput);
    const existingByTask = supervisionFlows().filter(
      (flow) => readSupervisionState(flow).taskId === manifest.taskId,
    );
    if (existingByTask.length > 1) {
      throw new Error("More than one supervision flow owns this task id.");
    }
    if (existingByTask[0]) {
      const existing = readSupervisionState(existingByTask[0]);
      if (existing.manifestHash !== manifestHash) {
        throw new Error("The task id is already bound to another manifest.");
      }
      return {
        enqueued: false,
        resumed: true,
        ...publicSupervision(existingByTask[0]),
      };
    }
    const at = timestamp(now);
    const flow = flowRuntime.createManaged({
      controllerId: ENGINEERING_SUPERVISION_CONTROLLER,
      goal: manifest.objective,
      status: "queued",
      notifyPolicy: "state_changes",
      currentStep: "queued",
      stateJson: createSupervisionState({ manifest, manifestHash, now: at }),
      createdAt: at,
      updatedAt: at,
    });
    return { enqueued: true, resumed: false, ...publicSupervision(flow) };
  }

  function missingDependencies(state, flows) {
    return state.manifest.dependencies.filter((dependencyTaskId) => {
      const candidates = flows.filter(
        (flow) => readSupervisionState(flow).taskId === dependencyTaskId,
      );
      if (candidates.length !== 1) return true;
      const dependency = candidates[0];
      const dependencyState = readSupervisionState(dependency);
      return (
        dependency.status !== "succeeded" ||
        dependencyState.phase !== "succeeded"
      );
    });
  }

  function dispatch(flow, laneResult) {
    const state = readSupervisionState(flow);
    return buildWorkerDispatch({
      flow,
      state,
      laneResult,
      runtimeTimeoutSeconds,
      workerAgentId: ENGINEERING_WORKER_AGENT,
    });
  }

  function resumeReadyFlow(flow) {
    const state = readSupervisionState(flow);
    const laneResult = lane.provision(state.manifest);
    if (
      laneResult.taskId !== state.taskId ||
      laneResult.manifestHash !== state.manifestHash
    ) {
      throw new Error("The lane result does not match the durable flow.");
    }
    const workerDispatch = dispatch(flow, laneResult);
    const matches = findNativeDispatchMatches(taskRuns, workerDispatch);
    if (matches.length === 0) return workerDispatch;
    if (matches.length > 1) {
      return {
        claimed: false,
        recoveredAttached: false,
        ...block(
          flow,
          state,
          null,
          "duplicate_native_dispatch",
          "More than one native worker matches the durable dispatch; automatic recovery stopped.",
        ),
      };
    }
    try {
      return {
        claimed: false,
        recoveredAttached: true,
        reason: "Recovered the existing native worker; do not spawn another.",
        ...attach({
          flowId: flow.flowId,
          expectedRevision: flow.revision,
          runId: matches[0].runId,
        }),
      };
    } catch (error) {
      return {
        claimed: false,
        recoveredAttached: false,
        ...block(
          flow,
          state,
          matches[0],
          "native_dispatch_mismatch",
          error instanceof Error
            ? error.message
            : "The discovered native worker did not match the durable dispatch.",
        ),
      };
    }
  }

  function claim() {
    const flows = supervisionFlows().sort(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left.flowId.localeCompare(right.flowId),
    );
    const active = flows.filter((flow) =>
      ACTIVE_PHASES.has(readSupervisionState(flow).phase),
    );
    if (active.length > 1) {
      throw new Error("More than one engineering worker flow is active.");
    }
    if (active[0]) {
      const state = readSupervisionState(active[0]);
      if (state.phase === "worker_ready") return resumeReadyFlow(active[0]);
      return {
        claimed: false,
        reason: "An engineering worker is already active.",
        active: publicSupervision(active[0]),
      };
    }

    const blocked = flows.find((flow) =>
      ["blocked", "failed"].includes(readSupervisionState(flow).phase),
    );
    if (blocked) {
      return {
        claimed: false,
        reason: "A prior engineering flow requires operator attention.",
        active: publicSupervision(blocked),
      };
    }

    for (const candidate of flows) {
      let flow = candidate;
      let state = readSupervisionState(flow);
      if (!["queued", "dependency_wait", "retry_ready"].includes(state.phase)) {
        continue;
      }
      const missing = missingDependencies(state, flows);
      if (missing.length > 0) {
        if (state.phase !== "dependency_wait") {
          const at = timestamp(now);
          state = checkpointState(
            state,
            "dependency_wait",
            `Waiting for ${missing.join(", ")}.`,
            at,
            { phase: "dependency_wait" },
          );
          flow = mutation(
            flowRuntime.setWaiting({
              flowId: flow.flowId,
              expectedRevision: flow.revision,
              currentStep: "dependency_wait",
              stateJson: state,
              waitJson: { kind: "dependencies", taskIds: missing },
              updatedAt: at,
            }),
            "Dependency checkpoint",
          );
        }
        continue;
      }
      if (state.attempts.length >= state.manifest.limits.maxAttempts) {
        throw new Error("The task has no remaining worker attempts.");
      }
      const laneResult = lane.provision(state.manifest);
      if (
        laneResult.taskId !== state.taskId ||
        laneResult.manifestHash !== state.manifestHash
      ) {
        throw new Error("The provisioned lane does not match the queued task.");
      }
      const at = timestamp(now);
      const number = state.attempts.length + 1;
      const remainingAttempts = state.manifest.limits.maxAttempts - number + 1;
      const remainingBudget =
        state.manifest.limits.maxCostCents - state.cumulativeCostCents;
      const attempt = {
        number,
        dispatchKey: `${state.taskId}:${state.manifestHash.slice(7, 23)}:${number}`,
        taskName: `eng_${state.manifestHash.slice(7, 19)}_a${number}`,
        status: "ready",
        worktreePath: laneResult.worktreePath,
        budgetCents: Math.floor(remainingBudget / (remainingAttempts * 2)),
        startedAt: at,
        deadlineAt: at + state.manifest.limits.workerTimeoutMinutes * 60_000,
        endedAt: null,
        runId: null,
        taskRunId: null,
        childSessionKey: null,
        error: null,
        cumulativeCostCents: state.cumulativeCostCents,
      };
      state = checkpointState(
        state,
        "worker_ready",
        `Attempt ${number} is ready for the named coding worker.`,
        at,
        { phase: "worker_ready", attempts: [...state.attempts, attempt] },
      );
      flow = mutation(
        flowRuntime.resume({
          flowId: flow.flowId,
          expectedRevision: flow.revision,
          status: "running",
          currentStep: "worker_ready",
          stateJson: state,
          updatedAt: at,
        }),
        "Worker claim",
      );
      return dispatch(flow, laneResult);
    }
    return {
      claimed: false,
      reason: "No dependency-ready engineering task is queued.",
    };
  }

  function attach({ flowId, expectedRevision, runId }) {
    let flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    let state = readSupervisionState(flow);
    if (state.phase !== "worker_ready") {
      throw new Error("Only a ready worker attempt can attach a native task.");
    }
    const attempt = activeAttempt(state);
    const laneResult = lane.provision(state.manifest);
    const expectedDispatch = dispatch(flow, laneResult);
    const nativeMatches = findNativeDispatchMatches(
      taskRuns,
      expectedDispatch,
    ).filter((task) => task.runId === runId);
    if (nativeMatches.length !== 1) {
      throw new Error(
        "The run ID does not identify exactly one named Sanctuary coding worker.",
      );
    }
    const task = assertAttachableNativeTask({
      task: nativeMatches[0],
      runId,
      expectedDispatch,
      attempt,
    });
    const at = timestamp(now);
    state = replaceActiveAttempt(state, attempt, {
      status: task.status,
      runId,
      taskRunId: task.id,
      childSessionKey: task.childSessionKey,
      endedAt: TERMINAL_NATIVE_STATUSES.has(task.status)
        ? (task.endedAt ?? at)
        : null,
    });
    state = checkpointState(
      state,
      "worker_attached",
      `Attempt ${attempt.number} is bound to native task ${task.id}.`,
      at,
      { phase: "worker_running" },
    );
    flow = mutation(
      flowRuntime.resume({
        flowId,
        expectedRevision,
        status: "running",
        currentStep: "worker_running",
        stateJson: state,
        updatedAt: at,
      }),
      "Native task attachment",
    );
    return publicSupervision(flow);
  }

  const postWorker = createCiReviewController({
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
  });

  async function reconcile({ flowId, expectedRevision, completion }) {
    let flow = getFlow(flowId);
    assertExpectedRevision(flow, expectedRevision);
    let state = readSupervisionState(flow);
    if (!["worker_running", "awaiting_completion"].includes(state.phase)) {
      throw new Error("The flow has no attached worker to reconcile.");
    }
    let attempt = activeAttempt(state);
    const task = assertNativeTaskIdentity(
      taskRuns.resolve(attempt.runId),
      attempt,
      ENGINEERING_WORKER_AGENT,
    );

    if (["queued", "running"].includes(task.status)) {
      const at = timestamp(now);
      if (at <= attempt.deadlineAt) {
        return { retryReady: false, waiting: true, ...publicSupervision(flow) };
      }
      if (!runtimeConfig) {
        return block(
          flow,
          state,
          task,
          "timeout_cancel_unavailable",
          "The worker exceeded its deadline but no runtime config was available for safe cancellation.",
        );
      }
      const cancelled = await taskRuns.cancel({
        taskId: task.id,
        cfg: runtimeConfig,
      });
      if (!cancelled?.cancelled) {
        return block(
          flow,
          state,
          task,
          "timeout_cancel_failed",
          cancelled?.reason ??
            "The overdue native task could not be cancelled.",
        );
      }
      return scheduleRetry(
        flow,
        state,
        cancelled.task ?? task,
        "timed_out",
        "The manifest worker deadline expired and the native task was cancelled.",
      );
    }

    if (!TERMINAL_NATIVE_STATUSES.has(task.status)) {
      throw new Error("The native task returned an unknown lifecycle state.");
    }
    if (["timed_out", "lost"].includes(task.status)) {
      return scheduleRetry(
        flow,
        state,
        task,
        task.status,
        task.error ?? `The native task ended ${task.status}.`,
      );
    }
    if (["failed", "cancelled"].includes(task.status)) {
      const reason =
        task.error ??
        `The native task ended ${task.status}; automatic retry is not classified safe.`;
      state = replaceActiveAttempt(state, attempt, {
        status: task.status,
        endedAt: task.endedAt ?? timestamp(now),
        error: reason,
      });
      return block(flow, state, task, `native_${task.status}`, reason);
    }
    if (!completion) {
      if (state.phase === "awaiting_completion") {
        return { retryReady: false, waiting: true, ...publicSupervision(flow) };
      }
      const at = timestamp(now);
      state = replaceActiveAttempt(state, attempt, {
        status: "succeeded",
        endedAt: task.endedAt ?? at,
      });
      state = checkpointState(
        state,
        "awaiting_completion",
        "The native worker succeeded; strict completion evidence is required.",
        at,
        { phase: "awaiting_completion" },
      );
      flow = mutation(
        flowRuntime.setWaiting({
          flowId,
          expectedRevision,
          currentStep: "awaiting_completion",
          stateJson: state,
          waitJson: { kind: "completion_evidence", runId: task.runId },
          updatedAt: at,
        }),
        "Completion checkpoint",
      );
      return { retryReady: false, waiting: true, ...publicSupervision(flow) };
    }

    const evidence = validateSupervisionCompletion({
      contractAdapter,
      lane,
      repoRoot,
      stateDir,
      state,
      task,
      completionInput: completion,
    });
    attempt = activeAttempt(state);
    state = replaceActiveAttempt(state, attempt, {
      status: completion.outcome === "succeeded" ? "succeeded" : "failed",
      endedAt: task.endedAt ?? timestamp(now),
      cumulativeCostCents: completion.worker.costCents,
      error: completion.outcome === "succeeded" ? null : completion.nextAction,
    });
    state = {
      ...state,
      cumulativeCostCents: completion.worker.costCents,
      completion: evidence.completion,
    };

    if (completion.outcome === "succeeded") {
      return postWorker.awaitCi(flow, state);
    }
    if (completion.outcome === "blocked") {
      return block(flow, state, task, "worker_blocked", completion.nextAction);
    }
    if (
      completion.safety.worktreeClean &&
      completion.safety.secretScan === "passed" &&
      !completion.safety.merged &&
      !completion.safety.productionEffects
    ) {
      return scheduleRetry(flow, state, task, "failed", completion.nextAction);
    }
    return block(
      flow,
      state,
      task,
      "unsafe_retry_refused",
      "The failed completion is not clean and secret-safe enough to retry automatically.",
    );
  }

  async function recover() {
    const flows = supervisionFlows();
    const active = flows.filter((flow) =>
      ACTIVE_PHASES.has(readSupervisionState(flow).phase),
    );
    if (active.length > 1) {
      throw new Error("More than one engineering worker flow is active.");
    }
    if (!active[0]) return claim();
    const state = readSupervisionState(active[0]);
    if (POST_WORKER_ACTIVE_PHASES.has(state.phase)) {
      return postWorker.recover(active[0]);
    }
    if (state.phase === "worker_ready") {
      const resumed = resumeReadyFlow(active[0]);
      if (!resumed.recoveredAttached) return resumed;
      const reconciled = await reconcile({
        flowId: resumed.flowId,
        expectedRevision: resumed.revision,
      });
      return { recoveredAttached: true, ...reconciled };
    }
    const result = await reconcile({
      flowId: active[0].flowId,
      expectedRevision: active[0].revision,
    });
    return result.retryReady ? claim() : result;
  }

  function status(taskId, manifestHash) {
    return publicSupervision(findTaskFlow(taskId, manifestHash));
  }

  return Object.freeze({
    enqueue,
    claim,
    attach,
    reconcile,
    recover,
    status,
    inspectCi: postWorker.inspectCi,
    attachReview: postWorker.attachReview,
    reconcileReview: postWorker.reconcileReview,
  });
}
