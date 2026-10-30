import 'server-only';

/** Bound the stream itself, including requests without Content-Length. */
export async function readStudioRequestBody(request: Request, maximumBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw Error('Missing request');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) { await reader.cancel(); throw Error('Oversized request'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
}
