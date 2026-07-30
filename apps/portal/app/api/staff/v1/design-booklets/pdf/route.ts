import { requireStaffSession } from '@/lib/api/staffApi';
import { handleDesignBookletPdfRequest } from '@/lib/designBooklets/pdfRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const session = await requireStaffSession();
  if (!session) {
    return Response.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      },
    );
  }
  return handleDesignBookletPdfRequest(request);
}
