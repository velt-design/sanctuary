import { jsonError, requireAdminSession } from '@/lib/api/adminApi';
import { previewInvoiceDraft } from '@/lib/invoices/drafts';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string; invoiceId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  try {
    const { projectId, invoiceId } = await context.params;
    const bytes = await previewInvoiceDraft(projectId, invoiceId);
    return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="invoice-draft-preview.pdf"' } });
  } catch { return jsonError('Invoice draft preview unavailable', 404); }
}
