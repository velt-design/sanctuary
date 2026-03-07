export const PORTAL_THEME_OVERRIDE_KEYS = ['accent', 'text', 'text_muted', 'text_inverse', 'bg_page', 'bg_surface', 'border'] as const;

export type PortalThemeOverrideKey = (typeof PORTAL_THEME_OVERRIDE_KEYS)[number];
export type PortalThemePresetId = 'sanctuary-burgundy' | 'stone-olive' | 'harbor-blue';
export type PortalThemeMode = 'merge' | 'replace' | 'reset';
export type HexColor = `#${string}`;

export type PortalThemeTokens = Record<PortalThemeOverrideKey, HexColor>;
export type PortalThemeOverrides = Partial<PortalThemeTokens>;

export type PortalThemePreset = {
  id: PortalThemePresetId;
  label: string;
  tokens: PortalThemeTokens;
};

export type PortalResolvedTheme = {
  preset_id: PortalThemePresetId;
  overrides: PortalThemeOverrides;
  tokens: PortalThemeTokens;
  accent_rgb_csv: string;
  is_customized: boolean;
  updated_at: string | null;
};

