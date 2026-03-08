import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { PORTAL_THEME_PRESETS, findPortalThemePresetById } from '@/lib/theme/presets';
import { resolvePortalTheme } from '@/lib/theme/resolve';
import {
  getPortalUserPresetById,
  isMissingPortalThemeSettingsTableError,
  listPortalUserPresets,
  parsePortalThemeRow,
  validateOverridesForPatch,
} from '@/lib/theme/server';
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

function parseUserPresetId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value || null;
}

function listSystemPresetSummaries() {
  return PORTAL_THEME_PRESETS.map((preset) => ({ id: preset.id, label: preset.label, tokens: preset.tokens, immutable: true as const }));
}

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const supabase = await getSupabaseServerAuth();
  const systemPresets = listSystemPresetSummaries();

  const settingsRes = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,user_preset_id,overrides,updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (settingsRes.error) {
    if (isMissingPortalThemeSettingsTableError(settingsRes.error)) {
      const fallback = resolvePortalTheme();
      return jsonOk({
        ok: true,
        presets: systemPresets,
        system_presets: systemPresets,
        user_presets: [],
        theme: fallback,
        missing_table: true,
      });
    }
    return jsonError(settingsRes.error.message ?? 'Failed to load theme settings', 500);
  }

  let userPresets = [] as Awaited<ReturnType<typeof listPortalUserPresets>>;
  try {
    userPresets = await listPortalUserPresets(session.user.id);
  } catch (err) {
    if (!isMissingPortalThemeSettingsTableError(err)) {
      return jsonError((err as { message?: string })?.message ?? 'Failed to load theme presets', 500);
    }
  }

  const row = (settingsRes.data ?? null) as any;
  const selectedUserPreset = row?.user_preset_id ? userPresets.find((preset) => preset.id === row.user_preset_id) ?? null : null;
  const theme = parsePortalThemeRow(row, selectedUserPreset);

  return jsonOk({
    ok: true,
    presets: systemPresets,
    system_presets: systemPresets,
    user_presets: userPresets,
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

  const requestedUserPresetIdRaw = typeof body.user_preset_id === 'undefined' ? undefined : parseUserPresetId(body.user_preset_id);
  if (typeof body.user_preset_id !== 'undefined' && !requestedUserPresetIdRaw) {
    return jsonError('user_preset_id must be a non-empty string', 400);
  }

  if (requestedPreset && requestedUserPresetIdRaw) {
    return jsonError('Provide either preset_id or user_preset_id, not both', 400);
  }

  let requestedOverrides: PortalThemeOverrides | null = null;
  if (typeof body.overrides !== 'undefined') {
    const validated = validateOverridesForPatch(body.overrides);
    if (!validated.ok) return jsonError(validated.error, 400);
    requestedOverrides = validated.overrides;
  }

  const existingRes = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,user_preset_id,overrides')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (existingRes.error) {
    if (isMissingPortalThemeSettingsTableError(existingRes.error)) {
      return jsonError('Theme settings table is not available yet. Run latest migrations and retry.', 501);
    }
    return jsonError(existingRes.error.message ?? 'Failed to load existing theme settings', 500);
  }

  const existingPreset = parsePresetId(existingRes.data?.preset_id) ?? resolvePortalTheme().preset_id;
  const existingUserPresetId = parseUserPresetId(existingRes.data?.user_preset_id);
  const existingOverrides = sanitizePortalThemeOverrides(existingRes.data?.overrides).overrides;

  let nextPreset = existingPreset;
  let nextUserPresetId = existingUserPresetId;

  if (requestedPreset) {
    nextPreset = requestedPreset;
    nextUserPresetId = null;
  }

  if (requestedUserPresetIdRaw) {
    const selected = await getPortalUserPresetById(session.user.id, requestedUserPresetIdRaw);
    if (!selected) return jsonError('Unsupported user_preset_id', 400);
    nextUserPresetId = selected.id;
  }

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
        user_preset_id: nextUserPresetId,
        overrides: nextOverrides,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: 'user_id' },
    )
    .select('preset_id,user_preset_id,overrides,updated_at')
    .single();
  if (upsertRes.error) {
    return jsonError(upsertRes.error.message ?? 'Failed to save theme settings', 500);
  }

  const userPresets = await listPortalUserPresets(session.user.id);
  const selectedUserPreset = upsertRes.data?.user_preset_id
    ? userPresets.find((preset) => preset.id === upsertRes.data.user_preset_id) ?? null
    : null;
  const theme = parsePortalThemeRow(upsertRes.data as any, selectedUserPreset);
  const systemPresets = listSystemPresetSummaries();

  return jsonOk({
    ok: true,
    presets: systemPresets,
    system_presets: systemPresets,
    user_presets: userPresets,
    theme,
  });
}
