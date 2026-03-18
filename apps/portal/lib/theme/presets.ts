import type { PortalThemePreset, PortalThemePresetId, PortalThemeTokens } from './types';

const SANCTUARY_BURGUNDY_TOKENS: PortalThemeTokens = {
  accent: '#813F39',
  text: '#0F0F10',
  text_muted: '#666666',
  text_inverse: '#FFFFFF',
  bg_page: '#ECEDEE',
  bg_surface: '#F7F8F9',
  border: '#D6D7D9',
};

const STONE_OLIVE_TOKENS: PortalThemeTokens = {
  accent: '#4F5748',
  text: '#121312',
  text_muted: '#5F655E',
  text_inverse: '#FFFFFF',
  bg_page: '#ECEEEB',
  bg_surface: '#F6F7F4',
  border: '#D0D4CC',
};

const HARBOR_BLUE_TOKENS: PortalThemeTokens = {
  accent: '#1F6E8C',
  text: '#0F1214',
  text_muted: '#59656D',
  text_inverse: '#FFFFFF',
  bg_page: '#EBEFF1',
  bg_surface: '#F5F8FA',
  border: '#CED7DD',
};

const MONOCHROME_TOKENS: PortalThemeTokens = {
  accent: '#333333',
  text: '#404040',
  text_muted: '#666666',
  text_inverse: '#E6E6E6',
  bg_page: '#D9D9D9',
  bg_surface: '#F2F2F2',
  border: '#D1D1D1',
};

export const PORTAL_THEME_PRESETS: PortalThemePreset[] = [
  { id: 'stone-olive', label: 'Stone Olive', tokens: STONE_OLIVE_TOKENS },
  { id: 'sanctuary-burgundy', label: 'Sanctuary Burgundy', tokens: SANCTUARY_BURGUNDY_TOKENS },
  { id: 'harbor-blue', label: 'Harbor Blue', tokens: HARBOR_BLUE_TOKENS },
  { id: 'monochrome', label: 'Monochrome', tokens: MONOCHROME_TOKENS },
];

export const PORTAL_DEFAULT_THEME_PRESET_ID: PortalThemePresetId = 'stone-olive';
export const PORTAL_DEFAULT_THEME_PRESET: PortalThemePreset =
  PORTAL_THEME_PRESETS.find((preset) => preset.id === PORTAL_DEFAULT_THEME_PRESET_ID) ?? PORTAL_THEME_PRESETS[0];
export const PORTAL_DEFAULT_THEME_TOKENS: PortalThemeTokens = PORTAL_DEFAULT_THEME_PRESET.tokens;

export const PORTAL_DEFAULT_ACCENT_HEX = SANCTUARY_BURGUNDY_TOKENS.accent;
export const PORTAL_DEFAULT_ACCENT_RGB_CSV = '129, 63, 57' as const;
export const PORTAL_DEFAULT_ACCENT_PDF_RGB = {
  r: 129 / 255,
  g: 63 / 255,
  b: 57 / 255,
} as const;

const PRESET_BY_ID = new Map<PortalThemePresetId, PortalThemePreset>(PORTAL_THEME_PRESETS.map((preset) => [preset.id, preset]));

export function findPortalThemePresetById(id: unknown): PortalThemePreset | null {
  if (typeof id !== 'string') return null;
  return PRESET_BY_ID.get(id as PortalThemePresetId) ?? null;
}

