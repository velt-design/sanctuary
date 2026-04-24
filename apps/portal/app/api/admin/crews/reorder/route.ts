import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body ?? {};

  const orderedIdsRaw: unknown[] = Array.isArray(body.ordered_ids) ? body.ordered_ids : [];
  const orderedIds = orderedIdsRaw.map((value: unknown) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean);

  if (!orderedIds.length) return jsonError('ordered_ids must be a non-empty array', 400);

  const uniqueCount = new Set(orderedIds).size;
  if (uniqueCount !== orderedIds.length) return jsonError('ordered_ids contains duplicates', 400);

  for (let index = 0; index < orderedIds.length; index += 1) {
    const crewId = orderedIds[index];
    const updateRes = await supabase.from('schedule_crews').update({ sort_order: index + 1 } as any).eq('id', crewId);
    if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to reorder crews', 500);
  }

  return jsonOk({ ok: true });
}
