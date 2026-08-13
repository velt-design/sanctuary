import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import {
  isMissingPortalThemeSettingsTableError,
  parsePortalThemeUserPresetRow,
  validateThemePresetName,
  validateThemeTokensForPreset,
} from '@/lib/theme/server';

export const runtime = 'nodejs';

function getPresetId(params: { presetId?: string }): string {
  return typeof params?.presetId === 'string' ? params.presetId.trim() : '';
}

export async function PATCH(req: Request, ctx: { params: Promise<{ presetId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { presetId: rawPresetId } = await ctx.params;
  const presetId = getPresetId({ presetId: rawPresetId });
  if (!presetId) return jsonError('presetId is required', 400);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const payload: Record<string, unknown> = {};

  if (typeof body.name !== 'undefined') {
    const name = validateThemePresetName(body.name);
    if (!name.ok) return jsonError(name.error, 400);
    payload.name = name.name;
  }

  if (typeof body.tokens !== 'undefined') {
    const tokens = validateThemeTokensForPreset(body.tokens);
    if (!tokens.ok) return jsonError(tokens.error, 400);
    payload.tokens = tokens.tokens;
  }

  if (!Object.keys(payload).length) {
    return jsonError('Nothing to update. Provide name and/or tokens.', 400);
  }

  const supabase = await getSupabaseServerAuth();
  const updateRes = await supabase
    .from('portal_user_theme_presets')
    .update(payload as any)
    .eq('id', presetId)
    .eq('user_id', session.user.id)
    .select('id,user_id,name,tokens,created_at,updated_at')
    .maybeSingle();

  if (updateRes.error) {
    if (updateRes.error.code === '23505') {
      return jsonError('A preset with this name already exists.', 409);
    }
    if (isMissingPortalThemeSettingsTableError(updateRes.error)) {
      return jsonError('Theme preset table is not available yet. Run latest migrations and retry.', 501);
    }
    return jsonError(updateRes.error.message ?? 'Failed to update preset', 500);
  }

  if (!updateRes.data) return jsonError('Preset not found', 404);

  const preset = parsePortalThemeUserPresetRow(updateRes.data as any);
  if (!preset) return jsonError('Updated preset is invalid.', 500);

  return jsonOk({ ok: true, preset });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ presetId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const { presetId: rawPresetId } = await ctx.params;
  const presetId = getPresetId({ presetId: rawPresetId });
  if (!presetId) return jsonError('presetId is required', 400);

  const supabase = await getSupabaseServerAuth();
  const deleteRes = await supabase
    .from('portal_user_theme_presets')
    .delete()
    .eq('id', presetId)
    .eq('user_id', session.user.id)
    .select('id')
    .maybeSingle();

  if (deleteRes.error) {
    if (isMissingPortalThemeSettingsTableError(deleteRes.error)) {
      return jsonError('Theme preset table is not available yet. Run latest migrations and retry.', 501);
    }
    return jsonError(deleteRes.error.message ?? 'Failed to delete preset', 500);
  }

  if (!deleteRes.data) return jsonOk({ ok: true, deleted_id: presetId, replayed: true });

  return jsonOk({ ok: true, deleted_id: presetId, replayed: false });
}
