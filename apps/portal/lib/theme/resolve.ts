import { findPortalThemePresetById, PORTAL_DEFAULT_THEME_PRESET, PORTAL_DEFAULT_THEME_PRESET_ID } from './presets';
import type { PortalResolvedTheme, PortalThemeOverrides, PortalThemePresetId } from './types';
import { hexToRgbCsv, sanitizePortalThemeOverrides } from './utils';

type ResolvePortalThemeInput = {
  preset_id?: unknown;
  overrides?: unknown;
  updated_at?: unknown;
};

export function resolvePortalTheme(input?: ResolvePortalThemeInput): PortalResolvedTheme {
  const preset = findPortalThemePresetById(input?.preset_id) ?? PORTAL_DEFAULT_THEME_PRESET;
  const presetId = preset.id as PortalThemePresetId;
  const sanitized = sanitizePortalThemeOverrides(input?.overrides);
  const overrides = sanitized.overrides as PortalThemeOverrides;
  const tokens = { ...preset.tokens, ...overrides };
  const accentRgbCsv = hexToRgbCsv(tokens.accent) || hexToRgbCsv(PORTAL_DEFAULT_THEME_PRESET.tokens.accent) || '129, 63, 57';
  const updatedAt = typeof input?.updated_at === 'string' && input.updated_at ? input.updated_at : null;

  return {
    preset_id: presetId || PORTAL_DEFAULT_THEME_PRESET_ID,
    overrides,
    tokens,
    accent_rgb_csv: accentRgbCsv,
    is_customized: Object.keys(overrides).length > 0,
    updated_at: updatedAt,
  };
}

