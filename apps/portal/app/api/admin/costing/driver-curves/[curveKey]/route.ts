import { requireAdminSession, parseJsonBody, jsonError, jsonOk } from '@/lib/api/adminApi';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Params = { curveKey: string };
type Ctx = { params: Params | Promise<Params> };

type DriverCurvePoint = {
  length_m: number;
  minutes_per_m: number;
};

function normalizePoints(value: unknown): DriverCurvePoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const lengthM = Number((entry as any)?.length_m);
      const minutesPerM = Number((entry as any)?.minutes_per_m);
      if (!Number.isFinite(lengthM) || !Number.isFinite(minutesPerM)) return null;
      return {
        length_m: Math.max(0, Math.round(lengthM * 1000) / 1000),
        minutes_per_m: Math.max(0, Math.round(minutesPerM * 1000) / 1000),
      };
    })
    .filter((entry): entry is DriverCurvePoint => entry !== null)
    .sort((a, b) => a.length_m - b.length_m);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { curveKey } = await Promise.resolve(params);
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;

  const curveKeyDecoded = decodeURIComponent(curveKey ?? '').trim();
  if (!curveKeyDecoded) return jsonError('Curve key is required', 400);

  const points = normalizePoints(parsed.body?.points);
  if (points.length < 2) return jsonError('points must contain at least 2 valid curve points', 400);

  const updatedBy = auth.session.user?.email ?? null;

  const res = await supabaseServer
    .from('install_driver_curve_overrides')
    .upsert(
      {
        curve_key: curveKeyDecoded,
        points_json: points,
        updated_by: updatedBy,
      },
      { onConflict: 'curve_key' },
    )
    .select('curve_key, points_json')
    .single();

  if (res.error) return jsonError(res.error.message ?? 'Failed to update driver curve', 500);

  return jsonOk({
    curve_key: res.data.curve_key,
    points: normalizePoints(res.data.points_json),
  });
}
