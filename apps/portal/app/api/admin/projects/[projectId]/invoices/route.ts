import { jsonError, jsonOk, parseJsonBody, requireAdminSession } from '@/lib/api/adminApi';
import { createAdminInvoice, getProjectInvoiceSchedule } from '@/lib/invoices/adminPayments';
import type { AdminInvoiceCreationMode } from '@/lib/invoices/types';

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
    return jsonOk({ schedule: await getProjectInvoiceSchedule(projectId.trim(), { includePaymentEntries: true }) });
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
  if (typeof body.quoteVersionId !== 'string' || typeof body.mode !== 'string' || typeof body.label !== 'string') {
    return jsonError('Quote version, creation mode and invoice label are required', 400);
  }
  const mode = body.mode as AdminInvoiceCreationMode;
  if (!['next_stage', 'full_remaining', 'custom', 'split'].includes(mode)) return jsonError('Invoice creation mode is invalid', 400);
  try {
    const result = await createAdminInvoice({
      projectId: projectId.trim(),
      quoteVersionId: body.quoteVersionId.trim(),
      mode,
      paymentTermId: typeof body.paymentTermId === 'string' ? body.paymentTermId.trim() : null,
      amountIncGstCents: typeof body.amountIncGstCents === 'number' ? body.amountIncGstCents : null,
      splitCount: typeof body.splitCount === 'number' ? body.splitCount : null,
      label: body.label,
      dueDate: typeof body.dueDate === 'string' ? body.dueDate : null,
      reference: typeof body.reference === 'string' ? body.reference : null,
      sendNow: body.sendNow === true,
      allowOverInvoice: body.allowOverInvoice === true,
      overrideReason: typeof body.overrideReason === 'string' ? body.overrideReason : null,
      calculationBasis: body.calculationBasis === 'percentage' ? 'percentage' : 'fixed',
      percentage: typeof body.percentage === 'number' ? body.percentage : null,
      actor: auth.session.user.id,
    });
    return jsonOk({ result }, 201);
  } catch (error) {
    const detail = message(error);
    const status = /not found/i.test(detail) ? 404 : /only accepted|does not belong|required|must be|invalid|exceeds|already|no remaining/i.test(detail) ? 400 : 500;
    return jsonError(detail, status);
  }
}
