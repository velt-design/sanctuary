import 'server-only';
import { z } from 'zod';
import { requireStaffContext, jsonError, jsonOk } from '@/lib/api/staffApi';
import { qualificationCommandSchema, qualificationViewSchema } from './contract';
import { uuidFromAppId } from '@/lib/supabase/mappers';

type Context = { params: Promise<{ projectId: string; enquiryId: string }> };
const idsSchema = z.object({ projectId: z.string().uuid(), enquiryId: z.string().uuid() });

export async function qualificationRequest(request: Request, context: Context, write: boolean) {
  const staff = await requireStaffContext();
  if (!staff.ok) return staff.response;
  const params = await context.params;
  let projectId: string;
  try { projectId = uuidFromAppId(params.projectId, 'proj'); } catch { return jsonError('Invalid project reference', 400); }
  const ids = idsSchema.safeParse({ ...params, projectId });
  if (!ids.success) return jsonError('Invalid enquiry reference', 400);
  const args: Record<string, unknown> = { p_project_id: ids.data.projectId, p_enquiry_id: ids.data.enquiryId };
  if (write) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return jsonError('Forbidden', 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return jsonError('JSON required', 415);
    const body = await request.text();
    if (body.length > 4096) return jsonError('Assessment is too large', 413);
    let value: unknown;
    try { value = JSON.parse(body); } catch { return jsonError('Invalid JSON', 400); }
    const command = qualificationCommandSchema.safeParse(value);
    if (!command.success) return jsonError(command.error.issues[0]?.message ?? 'Invalid assessment', 400);
    Object.assign(args, { p_command_id: command.data.commandId, p_expected_version: command.data.expectedVersion,
      p_state: command.data.state, p_criteria: command.data.criteria, p_reason: command.data.reason });
  }
  const { data, error } = await staff.supabase.rpc(write ? 'enquiry_qualification_record' : 'enquiry_qualification_read', args);
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'PT404' ? 404 : error.code === 'PT409' || error.code === '23505' ? 409 : error.code === 'PT400' ? 400 : 503;
    const message = status === 409 ? 'Another review may have been saved. Reload the assessment before trying again.'
      : status === 404 ? 'Enquiry not found.' : status === 403 ? 'Staff access is required.'
      : status === 400 ? 'This assessment is not valid for the submitted enquiry.' : 'Qualification is unavailable. Please retry.';
    return jsonError(message, status);
  }
  const view = qualificationViewSchema.safeParse(data);
  if (!view.success || view.data.projectId !== ids.data.projectId || view.data.enquiryId !== ids.data.enquiryId) return jsonError('Qualification response could not be verified. Reload before continuing.', 503);
  const response = jsonOk({ qualification: view.data });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
