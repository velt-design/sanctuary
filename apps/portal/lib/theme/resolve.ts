import { findPortalThemePresetById, PORTAL_DEFAULT_THEME_PRESET, PORTAL_DEFAULT_THEME_PRESET_ID } from './presets';
import type { PortalResolvedTheme, PortalThemeOverrides, PortalThemePresetId, PortalThemeTokens } from './types';
import { hexToRgbCsv, sanitizePortalThemeOverrides, sanitizePortalThemeTokens } from './utils';

type ResolvePortalThemeInput = {
  preset_id?: unknown;
  overrides?: unknown;
  updated_at?: unknown;
  user_preset?: {
    id?: unknown;
    name?: unknown;
    tokens?: unknown;
  } | null;
};

export function resolvePortalTheme(input?: ResolvePortalThemeInput): PortalResolvedTheme {
  const preset = findPortalThemePresetById(input?.preset_id) ?? PORTAL_DEFAULT_THEME_PRESET;
  const presetId = preset.id as PortalThemePresetId;
  const userPresetId = typeof input?.user_preset?.id === 'string' ? input.user_preset.id.trim() : '';
  const userPresetName = typeof input?.user_preset?.name === 'string' ? input.user_preset.name.trim() : '';

  let baseTokens: PortalThemeTokens = preset.tokens;
  let activePresetKind: PortalResolvedTheme['active_preset_kind'] = 'system';
  let activePresetId: PortalResolvedTheme['active_preset_id'] = preset.id;
  let activePresetLabel = preset.label;

  if (userPresetId && userPresetName) {
    const tokensSanitized = sanitizePortalThemeTokens(input?.user_preset?.tokens);
    if (!tokensSanitized.invalid_keys.length && !tokensSanitized.invalid_values.length && !tokensSanitized.missing_keys.length) {
      baseTokens = tokensSanitized.tokens as PortalThemeTokens;
      activePresetKind = 'user';
      activePresetId = userPresetId;
      activePresetLabel = userPresetName;
    }
  }

  const sanitized = sanitizePortalThemeOverrides(input?.overrides);
  const overrides = sanitized.overrides as PortalThemeOverrides;
  const tokens = { ...baseTokens, ...overrides };
  const accentRgbCsv = hexToRgbCsv(tokens.accent) || hexToRgbCsv(PORTAL_DEFAULT_THEME_PRESET.tokens.accent) || '129, 63, 57';
  const updatedAt = typeof input?.updated_at === 'string' && input.updated_at ? input.updated_at : null;

  return {
    preset_id: presetId || PORTAL_DEFAULT_THEME_PRESET_ID,
    user_preset_id: activePresetKind === 'user' ? activePresetId : null,
    active_preset_kind: activePresetKind,
    active_preset_id: activePresetId,
    active_preset_label: activePresetLabel,
    overrides,
    tokens,
    accent_rgb_csv: accentRgbCsv,
    is_customized: Object.keys(overrides).length > 0,
    updated_at: updatedAt,
  };
}
