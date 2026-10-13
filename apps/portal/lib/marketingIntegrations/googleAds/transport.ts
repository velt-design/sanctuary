export class GoogleFailure extends Error {
  constructor(readonly code: string, readonly retryable = false) { super(code); }
}
/** Never return provider text: errors and payloads can contain customer identifiers. */
export async function googleJson(fetcher: typeof fetch, url: string, init: RequestInit, limit = 8 * 1024 * 1024): Promise<unknown> {
  try {
    const response = await fetcher(url, { ...init, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([init.signal ?? new AbortController().signal, AbortSignal.timeout(20000)]) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new GoogleFailure(`HTTP_${response.status}`, response.status === 408 || response.status === 429 || response.status >= 500);
    }
    if (!response.body) throw new GoogleFailure('EMPTY_RESPONSE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength; if (size > limit) throw new GoogleFailure('RESPONSE_LIMIT'); chunks.push(item.value);
    } } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { if (error instanceof GoogleFailure) throw error; throw new GoogleFailure('TRANSPORT_UNCERTAIN', true); }
}
