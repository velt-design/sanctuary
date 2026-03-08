import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import {
  isMissingPortalThemeSettingsTableError,
  listPortalUserPresets,
  parsePortalThemeUserPresetRow,
  validateThemePresetName,
  validateThemeTokensForPreset,
} from '@/lib/theme/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  try {
    const presets = await listPortalUserPresets(session.user.id);
    return jsonOk({ ok: true, user_presets: presets });
  } catch (err) {
    if (isMissingPortalThemeSettingsTableError(err)) {
      return jsonOk({ ok: true, user_presets: [], missing_table: true });
    }
    return jsonError((err as { message?: string })?.message ?? 'Failed to load presets', 500);
  }
}

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const body = parsed.body ?? {};
  const name = validateThemePresetName(body.name);
  if (!name.ok) return jsonError(name.error, 400);

  const tokens = validateThemeTokensForPreset(body.tokens);
  if (!tokens.ok) return jsonError(tokens.error, 400);

  const supabase = await getSupabaseServerAuth();
  const insertRes = await supabase
    .from('portal_user_theme_presets')
    .insert({
      user_id: session.user.id,
      name: name.name,
      tokens: tokens.tokens,
    } as any)
    .select('id,user_id,name,tokens,created_at,updated_at')
    .single();

  if (insertRes.error) {
    if (insertRes.error.code === '23505') {
      return jsonError('A preset with this name already exists.', 409);
    }
    if (isMissingPortalThemeSettingsTableError(insertRes.error)) {
      return jsonError('Theme preset table is not available yet. Run latest migrations and retry.', 501);
    }
    return jsonError(insertRes.error.message ?? 'Failed to create preset', 500);
  }

  const preset = parsePortalThemeUserPresetRow(insertRes.data as any);
  if (!preset) return jsonError('Created preset is invalid.', 500);

  return jsonOk({ ok: true, preset });
}
