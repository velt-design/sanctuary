import { z } from 'zod';
import { applyRouteDiagnostics, createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { graphId } from '@/lib/projects/sharePointFiles/config';
import { listProjectFiles } from '@/lib/projects/sharePointFiles/server';
import { filesError, filesJson, privateResponse } from '@/lib/projects/sharePointFiles/http';
import { measureProjectFilesPhase, projectFilesPhases, type ProjectFilesPhase, type ProjectFilesTimingObserver } from '@/lib/projects/sharePointFiles/timing';
export const runtime = 'nodejs';
export const maxDuration = 60;
const querySchema = z.object({ rootId: z.uuid().optional(), folderId: graphId.optional(), cursor: z.string().max(8000).optional() }).strict();
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(request, '/api/staff/v1/projects/[projectId]/files');
  const timings = new Map<ProjectFilesPhase, number>();
  const observe: ProjectFilesTimingObserver = (phase, duration) => {
    if (projectFilesPhases.includes(phase) && Number.isFinite(duration) && duration >= 0 && duration < 1e12) timings.set(phase, duration);
  };
  const respond = (response: Response) => {
    applyRouteDiagnostics(response, diagnostics);
    if (response.status === 200) for (const phase of projectFilesPhases) {
      const duration = timings.get(phase);
      if (duration !== undefined) response.headers.append('server-timing', `files_${phase};dur=${duration.toFixed(1)}`);
    }
    return response;
  };
  const auth = await measureProjectFilesPhase('auth', observe, () => requireStaffContext(diagnostics));
  if (!auth.ok) return privateResponse(auth.response);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return respond(filesJson({ error: 'Invalid request' }, 400));
  try { return respond(filesJson(await listProjectFiles(auth.supabase, (await context.params).projectId, query.data, request.headers.get('x-vercel-oidc-token') ?? '', observe, request.signal))); }
  catch (error) { return respond(filesError(error)); }
}
