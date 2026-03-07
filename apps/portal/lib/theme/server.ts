import 'server-only';

import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { portalThemeCssVariables } from './cssVars';
import { PORTAL_THEME_PRESETS } from './presets';
import { resolvePortalTheme } from './resolve';
import type { PortalResolvedTheme, PortalThemeOverrides, PortalThemePresetId } from './types';
import { sanitizePortalThemeOverrides } from './utils';

type ThemeSettingsRow = {
  preset_id: string | null;
  overrides: unknown;
  updated_at: string | null;
};

function isMissingRelationError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e?.code === 'string' ? e.code.trim() : '';
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('relation');
}

export async function loadPortalThemeForUser(userId: string | null | undefined): Promise<PortalResolvedTheme> {
  if (!userId) return resolvePortalTheme();

  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,overrides,updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.error) {
    if (isMissingRelationError(res.error)) return resolvePortalTheme();
    throw res.error;
  }

  const row = (res.data ?? null) as ThemeSettingsRow | null;
  return resolvePortalTheme({
    preset_id: row?.preset_id ?? undefined,
    overrides: row?.overrides ?? undefined,
    updated_at: row?.updated_at ?? undefined,
  });
}

export function portalThemeStyleVars(theme: PortalResolvedTheme): Record<string, string> {
  return portalThemeCssVariables(theme);
}

export function listPortalThemePresets(): Array<{ id: PortalThemePresetId; label: string }> {
  return PORTAL_THEME_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }));
}

export function parsePortalThemeRow(row: ThemeSettingsRow | null): PortalResolvedTheme {
  return resolvePortalTheme({
    preset_id: row?.preset_id ?? undefined,
    overrides: row?.overrides ?? undefined,
    updated_at: row?.updated_at ?? undefined,
  });
}

export function validateOverridesForPatch(raw: unknown): {
  ok: true;
  overrides: PortalThemeOverrides;
} | {
  ok: false;
  error: string;
} {
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  if (!isObject) return { ok: false, error: 'overrides must be an object' };

  const sanitized = sanitizePortalThemeOverrides(raw);
  if (sanitized.invalid_keys.length) {
    return { ok: false, error: `Unsupported override keys: ${sanitized.invalid_keys.join(', ')}` };
  }
  if (sanitized.invalid_values.length) {
    return { ok: false, error: `Invalid color values for: ${sanitized.invalid_values.join(', ')}` };
  }

  return { ok: true, overrides: sanitized.overrides };
}

export { isMissingRelationError as isMissingPortalThemeSettingsTableError };
