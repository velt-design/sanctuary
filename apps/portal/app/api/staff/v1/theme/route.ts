import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { PORTAL_THEME_PRESETS, findPortalThemePresetById } from '@/lib/theme/presets';
import { resolvePortalTheme } from '@/lib/theme/resolve';
import { isMissingPortalThemeSettingsTableError, parsePortalThemeRow, validateOverridesForPatch } from '@/lib/theme/server';
import type { PortalThemeMode, PortalThemeOverrides, PortalThemePresetId } from '@/lib/theme/types';
import { sanitizePortalThemeOverrides } from '@/lib/theme/utils';

export const runtime = 'nodejs';

function parseMode(raw: unknown): PortalThemeMode | null {
  if (typeof raw === 'undefined' || raw === 'merge') return 'merge';
  if (raw === 'replace' || raw === 'reset') return raw;
  return null;
}

function parsePresetId(raw: unknown): PortalThemePresetId | null {
  const preset = findPortalThemePresetById(raw);
  return preset?.id ?? null;
}

function listPresetSummaries() {
  return PORTAL_THEME_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, tokens: preset.tokens }));
}

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,overrides,updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (res.error) {
    if (isMissingPortalThemeSettingsTableError(res.error)) {
      const fallback = resolvePortalTheme();
      return jsonOk({
        ok: true,
        presets: listPresetSummaries(),
        theme: fallback,
        missing_table: true,
      });
    }
    return jsonError(res.error.message ?? 'Failed to load theme settings', 500);
  }

  const theme = parsePortalThemeRow((res.data ?? null) as any);
  return jsonOk({
    ok: true,
    presets: listPresetSummaries(),
    theme,
  });
}

export async function PATCH(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);
  const supabase = await getSupabaseServerAuth();

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const mode = parseMode(body.mode);
  if (!mode) return jsonError('mode must be one of: merge, replace, reset', 400);
  const requestedPreset = typeof body.preset_id === 'string' ? parsePresetId(body.preset_id) : null;
  if (typeof body.preset_id === 'string' && !requestedPreset) {
    return jsonError(`Unsupported preset_id: ${body.preset_id}`, 400);
  }

  let requestedOverrides: PortalThemeOverrides | null = null;
  if (typeof body.overrides !== 'undefined') {
    const validated = validateOverridesForPatch(body.overrides);
    if (!validated.ok) return jsonError(validated.error, 400);
    requestedOverrides = validated.overrides;
  }

  const existingRes = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,overrides')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (existingRes.error) {
    if (isMissingPortalThemeSettingsTableError(existingRes.error)) {
      return jsonError('Theme settings table is not available yet. Run latest migrations and retry.', 501);
    }
    return jsonError(existingRes.error.message ?? 'Failed to load existing theme settings', 500);
  }

  const existingPreset = parsePresetId(existingRes.data?.preset_id) ?? resolvePortalTheme().preset_id;
  const existingOverrides = sanitizePortalThemeOverrides(existingRes.data?.overrides).overrides;

  const nextPreset = requestedPreset ?? existingPreset;
  let nextOverrides: PortalThemeOverrides;
  if (mode === 'reset') {
    nextOverrides = {};
  } else if (mode === 'replace') {
    nextOverrides = requestedOverrides ?? {};
  } else {
    nextOverrides = {
      ...existingOverrides,
      ...(requestedOverrides ?? {}),
    };
  }

  const upsertRes = await supabase
    .from('portal_user_theme_settings')
    .upsert(
      {
        user_id: session.user.id,
        preset_id: nextPreset,
        overrides: nextOverrides,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'user_id' },
    )
    .select('preset_id,overrides,updated_at')
    .single();
  if (upsertRes.error) {
    return jsonError(upsertRes.error.message ?? 'Failed to save theme settings', 500);
  }

  const theme = parsePortalThemeRow(upsertRes.data as any);
  return jsonOk({
    ok: true,
    presets: listPresetSummaries(),
    theme,
  });
}
