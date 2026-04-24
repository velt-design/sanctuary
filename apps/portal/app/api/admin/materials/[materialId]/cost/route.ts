import { requireAdminContext, parseJsonBody, jsonError, jsonOk } from '@/lib/api/adminApi';

export const runtime = 'nodejs';

type Params = { materialId: string };
type Ctx = { params: Params | Promise<Params> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { materialId } = await Promise.resolve(params);
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const materialIdDecoded = decodeURIComponent(materialId ?? '').trim();
  if (!materialIdDecoded) return jsonError('Material id is required', 400);

  const costRaw = parsed.body?.cost_ex_gst;
  const cost = typeof costRaw === 'number' ? costRaw : Number.parseFloat(String(costRaw ?? ''));
  if (!Number.isFinite(cost) || cost < 0) return jsonError('cost_ex_gst must be a number >= 0', 400);

  const costCents = Math.round(cost * 100);
  const updatedBy = auth.session.user?.email ?? null;

  const res = await supabase
    .from('material_cost_overrides')
    .upsert(
      {
        material_id: materialIdDecoded,
        cost_ex_gst_cents: costCents,
        updated_by: updatedBy,
      },
      { onConflict: 'material_id' },
    )
    .select('material_id, cost_ex_gst_cents')
    .single();

  if (res.error) return jsonError(res.error.message ?? 'Failed to update material cost', 500);

  return jsonOk({
    material_id: res.data.material_id,
    cost_ex_gst: Number(res.data.cost_ex_gst_cents ?? 0) / 100,
  });
}
