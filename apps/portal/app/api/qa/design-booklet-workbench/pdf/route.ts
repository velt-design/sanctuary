import { handleDesignBookletPdfRequest } from '@/lib/designBooklets/pdfRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export async function POST(request: Request): Promise<Response> {
  if (!arePortalQaFixturesEnabled()) {
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return handleDesignBookletPdfRequest(request);
}
