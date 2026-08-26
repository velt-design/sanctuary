const DEFAULT_POLL_INTERVAL_MS = 30_000;
export const ENGINEERING_CI_WATCH_WINDOW_MS = 2 * 60_000;
export const ENGINEERING_CI_TOOL_TIMEOUT_MS = 3 * 60_000;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function watchEngineeringCi({
  inspect,
  input,
  now = () => Date.now(),
  wait = delay,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  watchWindowMs = ENGINEERING_CI_WATCH_WINDOW_MS,
}) {
  if (typeof inspect !== "function" || typeof wait !== "function") {
    throw new Error("The CI watch requires inspection and wait functions.");
  }
  if (
    !Number.isSafeInteger(pollIntervalMs) ||
    pollIntervalMs < 0 ||
    !Number.isSafeInteger(watchWindowMs) ||
    watchWindowMs < 0
  ) {
    throw new Error("The CI watch window is invalid.");
  }
  const startedAt = now();
  let request = { ...input };
  while (true) {
    const result = inspect(request);
    if (result.phase !== "ci_pending" || result.flowStatus !== "waiting") {
      return result;
    }
    const elapsed = now() - startedAt;
    if (elapsed >= watchWindowMs) {
      return {
        ...result,
        watchWindowElapsed: true,
        retryAfterSeconds: Math.ceil(pollIntervalMs / 1_000),
      };
    }
    request = {
      flowId: result.flowId,
      expectedRevision: result.revision,
    };
    await wait(Math.min(pollIntervalMs, watchWindowMs - elapsed));
  }
}
