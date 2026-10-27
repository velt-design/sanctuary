// Fixed endpoints, no redirect following, no HTTP retries and bounded body reads.
// No caller-provided URLs or raw provider payloads cross the broker boundary.
export async function during<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const cancelled = () => reject(signal.reason);
    signal.addEventListener('abort', cancelled, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancelled));
  });
}
export async function boundedGoogleJson(fetcher: typeof fetch, url: string, init: RequestInit, byteLimit: 65536 | 262144 | 524288 = 65536, timeoutMs: 15000 | 45000 = 15000, budget?: { remaining: number }): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await during(fetcher(url, { ...init, cache: "no-store", redirect: "error", signal }), signal);
  if (!response.ok) { await response.body?.cancel(); throw new Error("Provider request failed."); }
  if (!response.body) throw new Error("Provider response missing.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await during(reader.read(), signal);
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (budget) budget.remaining -= chunk.value.byteLength;
      if (length > byteLimit || (budget && budget.remaining < 0)) throw new Error("Provider response exceeded limit.");
      chunks.push(chunk.value);
    }
  } finally { void reader.cancel().catch(() => undefined); }
  signal.throwIfAborted();
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
