import { z } from 'zod';
import { applyRouteDiagnostics, createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { projectFileOpenIdentity } from '@/lib/projects/sharePointFiles/openIdentity';
import { graphId } from '@/lib/projects/sharePointFiles/config';
import { inlineTypes, projectGraph } from '@/lib/projects/sharePointFiles/server';
import { filesError, filesJson } from '@/lib/projects/sharePointFiles/http';
import { ProjectFilesError, projectFilesHeaders } from '@/lib/projects/sharePointFiles/types';
import { measureProjectFilesPhase, projectFilesPhases, type ProjectFilesPhase, type ProjectFilesTimingObserver } from '@/lib/projects/sharePointFiles/timing';
import { PREVIEW_VERSION_REQUEST_HEADER, type PreviewVerification } from '@/lib/projects/sharePointFiles/previewVerification';
import { strongFileVersion, VERIFIED_FILE_VERSION_HEADER } from '@/lib/projects/sharePointFiles/fileVersion';
export const runtime = 'nodejs';
export const maxDuration = 60;
const querySchema = z.object({ rootId: z.uuid(), mode: z.enum(['view', 'download']) }).strict();
export async function GET(request: Request, context: { params: Promise<{ projectId: string; itemId: string }> }) {
  const diagnostics = createRouteDiagnostics(request, '/api/staff/v1/projects/[projectId]/files/[itemId]/open');
  const timings = new Map<ProjectFilesPhase, number>();
  const observe: ProjectFilesTimingObserver = (phase, duration) => { if (projectFilesPhases.includes(phase) && Number.isFinite(duration) && duration >= 0 && duration < 1e12) timings.set(phase, duration); };
  const respond = (response: Response) => {
    applyRouteDiagnostics(response, diagnostics);
    if (response.status === 200) for (const phase of projectFilesPhases) { const duration = timings.get(phase); if (duration !== undefined) response.headers.append('server-timing', `files_${phase};dur=${duration.toFixed(1)}`); }
    return response;
  };
  const supabase = await measureProjectFilesPhase('auth', observe, projectFileOpenIdentity);
  if (!supabase) return respond(filesJson({ error: 'Unauthorized' }, 401));
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const params = await context.params;
  if (!query.success || !graphId.safeParse(params.itemId).success) return respond(filesJson({ error: 'Invalid request' }, 400));
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
    const conditionalVersion = query.data.mode === 'view' ? strongFileVersion(request.headers.get(PREVIEW_VERSION_REQUEST_HEADER)) : null;
    if (query.data.mode === 'view' && request.headers.has(PREVIEW_VERSION_REQUEST_HEADER) && (!conditionalVersion || request.headers.has('range'))) return respond(filesJson({ error: 'Invalid preview verification' }, 400));
    const { graph, root } = await projectGraph(supabase, params.projectId, query.data.rootId, request.headers.get('x-vercel-oidc-token') ?? '', signal, params.itemId, observe);
    const result = await graph.download(root.itemId, params.itemId, conditionalVersion ?? undefined);
    // Large originals go directly to Microsoft's ephemeral download URL. No token or signed URL is persisted.
    if (query.data.mode === 'download') {
      if (!result.url) throw new ProjectFilesError('source_invalid');
      return respond(new Response(null, { status: 302, headers: { ...projectFilesHeaders, Location: result.url } }));
    }
    const mime = result.item.file?.mimeType ?? '';
    const size = result.item.size ?? Infinity;
    if (!inlineTypes.has(mime) || size > 50_000_000) return respond(filesJson({ error: 'Use Download for this file.' }, 400));
    const disposition = `inline; filename*=UTF-8''${encodeURIComponent(result.item.name).replace(/['()*]/g, value => '%' + value.charCodeAt(0).toString(16))}`;
    if (result.notModified) {
      if (!conditionalVersion) throw new ProjectFilesError('source_invalid');
      const receipt: PreviewVerification = { kind: 'project-file-current-v1', projectId: params.projectId, rootId: query.data.rootId, itemId: params.itemId, version: conditionalVersion, name: result.item.name, contentType: mime, size };
      return respond(filesJson(receipt));
    }
    const range = request.headers.get('range');
    if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return respond(filesJson({ error: 'Invalid range' }, 416));
    // Never forward Graph Authorization to the preauthenticated download endpoint.
    const source = await measureProjectFilesPhase('source_headers', observe, () => fetch(result.url, { cache: 'no-store', redirect: 'error', signal, headers: range ? { Range: range } : {} }));
    if (![200, 206, 416].includes(source.status)) throw new ProjectFilesError('source_unavailable');
    if (source.status === 416) { await source.body?.cancel(); return respond(filesJson({ error: 'Requested range is unavailable.' }, 416)); }
    if (Number(source.headers.get('content-length') ?? 0) > 50_000_000) { await source.body?.cancel(); throw new ProjectFilesError('source_invalid'); }
    const headers = new Headers({ ...projectFilesHeaders, 'Content-Type': mime, 'Content-Security-Policy': "sandbox; default-src 'none'", 'Content-Disposition': disposition });
    const sourceVersion = strongFileVersion(source.headers.get('etag'));
    if (sourceVersion) headers.set('ETag', sourceVersion);
    if (!range && source.status === 200 && sourceVersion && [result.item.eTag, result.item.cTag].includes(sourceVersion)) headers.set(VERIFIED_FILE_VERSION_HEADER, sourceVersion);
    for (const name of ['content-length', 'content-range', 'accept-ranges']) { const value = source.headers.get(name); if (value) headers.set(name, value); }
    let streamed = 0;
    const bounded = source.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { streamed += chunk.length; if (streamed > 50_000_000) { controller.error(new Error('Preview exceeds limit')); return; } controller.enqueue(chunk); } }));
    return respond(new Response(bounded, { status: source.status, headers }));
  } catch (error) { return respond(filesError(error)); }
}
