// Endpoints are selected by the concrete adapters, never by a browser/model.
// No automatic HTTP retries, redirects, unrestricted pagination or response logs.
export async function providerJson(fetcher: typeof fetch, url: string, init: RequestInit = {}, maximumBytes = 65536, timeoutMilliseconds = 15_000): Promise<{ body: unknown; requestId?: string }> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 262144) throw new Error("Invalid provider response bound.");
  if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1 || timeoutMilliseconds > 30_000) throw new Error("Invalid provider timeout bound.");
  return readBoundedJson(fetcher, url, init, maximumBytes, timeoutMilliseconds);
}

async function readBoundedJson(fetcher: typeof fetch, url: string, init: RequestInit, maximumBytes: number, timeoutMilliseconds = 15_000): Promise<{ body: unknown; requestId?: string }> {
  const timeout = AbortSignal.timeout(timeoutMilliseconds);
  const response = await fetcher(url, { ...init, cache: "no-store", redirect: "error", signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error("Provider read could not be confirmed."); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) {
    const next = await reader.read(); if (next.done) break;
    bytes += next.value.byteLength; if (bytes > maximumBytes) throw new Error("Provider response limit exceeded.");
    chunks.push(next.value);
  } } finally { await reader.cancel(); }
  const requestId = response.headers.get("request-id") ?? response.headers.get("x-fb-trace-id");
  return { body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
    requestId: requestId && /^[a-zA-Z0-9_:-]{1,128}$/.test(requestId) ? requestId : undefined };
}
