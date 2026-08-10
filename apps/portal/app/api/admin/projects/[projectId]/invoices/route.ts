import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { createScheduledInvoice, getProjectInvoiceSchedule } from '@/lib/invoices/adminPayments';

export const runtime = 'nodejs';

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Invoice request failed';
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError('Invalid projectId', 400);
  try {
    return jsonOk({ schedule: await getProjectInvoiceSchedule(projectId.trim()) });
  } catch (error) {
    return jsonError(message(error), 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  if (!projectId?.trim()) return jsonError('Invalid projectId', 400);
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};
  if (typeof body.quoteVersionId !== 'string' || typeof body.paymentTermId !== 'string') {
    return jsonError('Quote version and payment term are required', 400);
  }
  try {
    const result = await createScheduledInvoice({
      projectId: projectId.trim(),
      quoteVersionId: body.quoteVersionId.trim(),
      paymentTermId: body.paymentTermId.trim(),
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
      reference: typeof body.reference === 'string' ? body.reference : null,
      sendNow: body.sendNow === true,
      actor: auth.session.user.id,
    });
    return jsonOk({ result }, result.created ? 201 : 200);
  } catch (error) {
    const detail = message(error);
    const status = /not found/i.test(detail) ? 404 : /only accepted|earlier scheduled|does not belong|required|must be/i.test(detail) ? 400 : 500;
    return jsonError(detail, status);
  }
}
