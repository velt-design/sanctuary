import { projectSiteAddressRequest } from '@/lib/projects/siteAddressRequest.server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return projectSiteAddressRequest(request, (await context.params).projectId);
}
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  return projectSiteAddressRequest(request, (await context.params).projectId);
}
