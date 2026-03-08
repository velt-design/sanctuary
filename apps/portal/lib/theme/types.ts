export const PORTAL_THEME_OVERRIDE_KEYS = ['accent', 'text', 'text_muted', 'text_inverse', 'bg_page', 'bg_surface', 'border'] as const;

export type PortalThemeOverrideKey = (typeof PORTAL_THEME_OVERRIDE_KEYS)[number];
export type PortalThemePresetId = 'sanctuary-burgundy' | 'stone-olive' | 'harbor-blue';
export type PortalThemePresetKind = 'system' | 'user';
export type PortalThemeMode = 'merge' | 'replace' | 'reset';
export type HexColor = `#${string}`;

export type PortalThemeTokens = Record<PortalThemeOverrideKey, HexColor>;
export type PortalThemeOverrides = Partial<PortalThemeTokens>;

export type PortalThemePreset = {
  id: PortalThemePresetId;
  label: string;
  tokens: PortalThemeTokens;
};

export type PortalThemeUserPreset = {
  id: string;
  name: string;
  tokens: PortalThemeTokens;
  created_at: string | null;
  updated_at: string | null;
};

export type PortalResolvedTheme = {
  preset_id: PortalThemePresetId;
  user_preset_id: string | null;
  active_preset_kind: PortalThemePresetKind;
  active_preset_id: string;
  active_preset_label: string;
  overrides: PortalThemeOverrides;
  tokens: PortalThemeTokens;
  accent_rgb_csv: string;
  is_customized: boolean;
  updated_at: string | null;
};
