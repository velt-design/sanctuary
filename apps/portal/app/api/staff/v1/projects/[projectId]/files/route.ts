import { z } from 'zod';
import { applyRouteDiagnostics, createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { graphId } from '@/lib/projects/sharePointFiles/config';
import { listProjectFiles } from '@/lib/projects/sharePointFiles/server';
import { filesError, filesJson, privateResponse } from '@/lib/projects/sharePointFiles/http';
export const runtime = 'nodejs';
export const maxDuration = 60;
const querySchema = z.object({ rootId: z.uuid().optional(), folderId: graphId.optional(), cursor: z.string().max(8000).optional() }).strict();
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(request, '/api/staff/v1/projects/[projectId]/files');
  const respond = (response: Response) => applyRouteDiagnostics(response, diagnostics);
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateResponse(auth.response);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return respond(filesJson({ error: 'Invalid request' }, 400));
  try { return respond(filesJson(await listProjectFiles(auth.supabase, (await context.params).projectId, query.data, request.headers.get('x-vercel-oidc-token') ?? ''))); }
  catch (error) { return respond(filesError(error)); }
}
