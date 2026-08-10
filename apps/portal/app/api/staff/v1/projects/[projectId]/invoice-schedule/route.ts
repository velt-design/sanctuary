import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { getProjectInvoiceSchedule } from '@/lib/invoices/adminPayments';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);
  const { projectId } = await context.params;
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return jsonError('Invalid projectId', 400);
  try {
    return jsonOk({
      schedule: await getProjectInvoiceSchedule(id, { includePaymentEntries: session.role === 'admin' }),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Failed to load invoice schedule', 500);
  }
}
