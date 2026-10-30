import { projectSiteTravelRequest } from '@/lib/projects/siteTravelRequest.server';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{projectId:string}>}) {
  return projectSiteTravelRequest(request,(await context.params).projectId);
}
