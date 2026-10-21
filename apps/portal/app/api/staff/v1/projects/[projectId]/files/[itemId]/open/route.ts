import { z } from 'zod';
import { applyRouteDiagnostics, createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { graphId } from '@/lib/projects/sharePointFiles/config';
import { inlineTypes, projectGraph } from '@/lib/projects/sharePointFiles/server';
import { filesError, filesJson, privateResponse } from '@/lib/projects/sharePointFiles/http';
import { ProjectFilesError, projectFilesHeaders } from '@/lib/projects/sharePointFiles/types';
export const runtime = 'nodejs';
export const maxDuration = 60;
const querySchema = z.object({ rootId: z.uuid(), mode: z.enum(['view', 'download']) }).strict();
export async function GET(request: Request, context: { params: Promise<{ projectId: string; itemId: string }> }) {
  const diagnostics = createRouteDiagnostics(request, '/api/staff/v1/projects/[projectId]/files/[itemId]/open');
  const respond = (response: Response) => applyRouteDiagnostics(response, diagnostics);
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateResponse(auth.response);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const params = await context.params;
  if (!query.success || !graphId.safeParse(params.itemId).success) return respond(filesJson({ error: 'Invalid request' }, 400));
  try {
    const signal = AbortSignal.timeout(50000);
    const { graph, root } = await projectGraph(auth.supabase, params.projectId, query.data.rootId, request.headers.get('x-vercel-oidc-token') ?? '', signal);
    const result = await graph.download(root.itemId, params.itemId);
    // Large originals go directly to Microsoft's ephemeral download URL. No token or signed URL is persisted.
    if (query.data.mode === 'download') return respond(new Response(null, { status: 302, headers: { ...projectFilesHeaders, Location: result.url } }));
    const mime = result.item.file?.mimeType ?? '';
    if (!inlineTypes.has(mime) || (result.item.size ?? Infinity) > 50_000_000) return respond(filesJson({ error: 'Use Download for this file.' }, 400));
    const range = request.headers.get('range');
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return respond(filesJson({ error: 'Invalid range' }, 416));
    // Never forward Graph Authorization to the preauthenticated download endpoint.
    const source = await fetch(result.url, { cache: 'no-store', redirect: 'error', signal, headers: range ? { Range: range } : {} });
    if (![200, 206, 416].includes(source.status)) throw new ProjectFilesError('source_unavailable');
    if (source.status === 416) { await source.body?.cancel(); return respond(filesJson({ error: 'Requested range is unavailable.' }, 416)); }
    if (Number(source.headers.get('content-length') ?? 0) > 50_000_000) { await source.body?.cancel(); throw new ProjectFilesError('source_invalid'); }
    const headers = new Headers({ ...projectFilesHeaders, 'Content-Type': mime, 'Content-Security-Policy': "sandbox; default-src 'none'", 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(result.item.name).replace(/['()*]/g, value => '%' + value.charCodeAt(0).toString(16))}` });
    for (const name of ['content-length', 'content-range', 'accept-ranges']) { const value = source.headers.get(name); if (value) headers.set(name, value); }
    let streamed = 0;
    const bounded = source.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { streamed += chunk.length; if (streamed > 50_000_000) { controller.error(new Error('Preview exceeds limit')); return; } controller.enqueue(chunk); } }));
    return respond(new Response(bounded, { status: source.status, headers }));
  } catch (error) { return respond(filesError(error)); }
}
