import 'server-only';

import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { portalThemeCssVariables } from './cssVars';
import { resolvePortalTheme } from './resolve';
import type { PortalResolvedTheme, PortalThemeOverrides, PortalThemeTokens, PortalThemeUserPreset } from './types';
import { sanitizePortalThemeOverrides, sanitizePortalThemeTokens } from './utils';

type ThemeSettingsRow = {
  preset_id: string | null;
  user_preset_id: string | null;
  overrides: unknown;
  updated_at: string | null;
};

type ThemeUserPresetRow = {
  id: string;
  user_id: string;
  name: string;
  tokens: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function isMissingRelationError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e?.code === 'string' ? e.code.trim() : '';
  const message = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('relation');
}

export function parsePortalThemeUserPresetRow(row: ThemeUserPresetRow | null): PortalThemeUserPreset | null {
  if (!row) return null;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name) return null;

  const sanitized = sanitizePortalThemeTokens(row.tokens);
  if (sanitized.invalid_keys.length || sanitized.invalid_values.length || sanitized.missing_keys.length) return null;

  return {
    id,
    name,
    tokens: sanitized.tokens as PortalThemeTokens,
    created_at: typeof row.created_at === 'string' && row.created_at ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' && row.updated_at ? row.updated_at : null,
  };
}

export async function listPortalUserPresets(userId: string): Promise<PortalThemeUserPreset[]> {
  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('portal_user_theme_presets')
    .select('id,user_id,name,tokens,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (res.error) {
    if (isMissingRelationError(res.error)) return [];
    throw res.error;
  }

  return (res.data ?? []).map((row) => parsePortalThemeUserPresetRow(row as ThemeUserPresetRow)).filter((row): row is PortalThemeUserPreset => Boolean(row));
}

export async function getPortalUserPresetById(userId: string, presetId: string): Promise<PortalThemeUserPreset | null> {
  const id = typeof presetId === 'string' ? presetId.trim() : '';
  if (!id) return null;

  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('portal_user_theme_presets')
    .select('id,user_id,name,tokens,created_at,updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (res.error) {
    if (isMissingRelationError(res.error)) return null;
    throw res.error;
  }

  return parsePortalThemeUserPresetRow((res.data ?? null) as ThemeUserPresetRow | null);
}

export async function loadPortalThemeForUser(userId: string | null | undefined): Promise<PortalResolvedTheme> {
  if (!userId) return resolvePortalTheme();

  const supabase = await getSupabaseServerAuth();
  const res = await supabase
    .from('portal_user_theme_settings')
    .select('preset_id,user_preset_id,overrides,updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (res.error) {
    if (isMissingRelationError(res.error)) return resolvePortalTheme();
    throw res.error;
  }

  const row = (res.data ?? null) as ThemeSettingsRow | null;
  const selectedUserPreset = row?.user_preset_id ? await getPortalUserPresetById(userId, row.user_preset_id) : null;
  return parsePortalThemeRow(row, selectedUserPreset);
}

export function portalThemeStyleVars(theme: PortalResolvedTheme): Record<string, string> {
  return portalThemeCssVariables(theme);
}

export function parsePortalThemeRow(row: ThemeSettingsRow | null, userPreset?: PortalThemeUserPreset | null): PortalResolvedTheme {
  return resolvePortalTheme({
    preset_id: row?.preset_id ?? undefined,
    user_preset: userPreset
      ? {
          id: userPreset.id,
          name: userPreset.name,
          tokens: userPreset.tokens,
        }
      : null,
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

export function validateThemePresetName(raw: unknown): {
  ok: true;
  name: string;
} | {
  ok: false;
  error: string;
} {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: false, error: 'name is required' };
  if (value.length < 2) return { ok: false, error: 'name must be at least 2 characters' };
  if (value.length > 48) return { ok: false, error: 'name must be at most 48 characters' };
  return { ok: true, name: value };
}

export function validateThemeTokensForPreset(raw: unknown): {
  ok: true;
  tokens: PortalThemeTokens;
} | {
  ok: false;
  error: string;
} {
  const isObject = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
  if (!isObject) return { ok: false, error: 'tokens must be an object' };

  const sanitized = sanitizePortalThemeTokens(raw);
  if (sanitized.invalid_keys.length) {
    return { ok: false, error: `Unsupported token keys: ${sanitized.invalid_keys.join(', ')}` };
  }
  if (sanitized.invalid_values.length) {
    return { ok: false, error: `Invalid color values for: ${sanitized.invalid_values.join(', ')}` };
  }
  if (sanitized.missing_keys.length) {
    return { ok: false, error: `Missing token keys: ${sanitized.missing_keys.join(', ')}` };
  }

  return { ok: true, tokens: sanitized.tokens as PortalThemeTokens };
}

export { isMissingRelationError as isMissingPortalThemeSettingsTableError };
