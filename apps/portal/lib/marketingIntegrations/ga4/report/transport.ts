// Fixed endpoints, no redirect following, no HTTP retries and bounded body reads.
// No caller-provided URLs or raw provider payloads cross the broker boundary.
export async function boundedGoogleJson(fetcher: typeof fetch, url: string, init: RequestInit, byteLimit: 65536 | 262144 = 65536, timeoutMs: 15000 | 45000 = 15000): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetcher(url, { ...init, cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  if (!response.ok) { await response.body?.cancel(); throw new Error("Provider request failed."); }
  if (!response.body) throw new Error("Provider response missing.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > byteLimit) throw new Error("Provider response exceeded limit.");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
