import { projectFileOpenIdentity } from '@/lib/projects/sharePointFiles/openIdentity';
import { filesError, filesJson } from '@/lib/projects/sharePointFiles/http';
import { previewBatchRequest } from '@/lib/projects/sharePointFiles/previews/contracts';
import { projectPreviewBatch } from '@/lib/projects/sharePointFiles/previews/batch';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const db = await projectFileOpenIdentity();
  if (!db) return filesJson({ error: 'Unauthorized' }, 401);
  if (process.env.SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED !== 'true') return filesJson({ error: 'Preview preparation is unavailable', code: 'preview_cache_disabled' }, 503);
  const url = new URL(request.url);
  if (request.headers.get('origin') !== url.origin || url.search || Number(request.headers.get('content-length') ?? 0) > 16_384) return filesJson({ error: 'Invalid request' }, 400);
  try {
    const reader = request.body?.getReader();
    if (!reader) return filesJson({ error: 'Invalid request' }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.length;
      if (length > 16_384) { await reader.cancel(); return filesJson({ error: 'Invalid request' }, 400); }
      chunks.push(part.value);
    }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return filesJson({ error: 'Invalid request' }, 400); }
    const input = previewBatchRequest.safeParse(value);
    if (!input.success) return filesJson({ error: 'Invalid request' }, 400);
    const { projectId } = await context.params;
    return await projectPreviewBatch(db, projectId, input.data, request.headers.get('x-vercel-oidc-token') ?? '', AbortSignal.any([request.signal, AbortSignal.timeout(50_000)]));
  } catch (error) { return filesError(error); }
}
