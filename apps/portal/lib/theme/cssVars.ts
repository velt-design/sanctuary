import type { PortalResolvedTheme } from './types';
import { hexToRgbCsv } from './utils';

type ThemeShape = Pick<PortalResolvedTheme, 'tokens' | 'accent_rgb_csv'>;

export function portalThemeCssVariables(theme: ThemeShape): Record<string, string> {
  const textRgb = hexToRgbCsv(theme.tokens.text) || '15, 15, 16';
  const textInverseRgb = hexToRgbCsv(theme.tokens.text_inverse) || '255, 255, 255';
  const borderRgb = hexToRgbCsv(theme.tokens.border) || '214, 215, 217';
  const bgPageRgb = hexToRgbCsv(theme.tokens.bg_page) || '236, 237, 238';
  const bgSurfaceRgb = hexToRgbCsv(theme.tokens.bg_surface) || '247, 248, 249';

  return {
    '--portal-accent': theme.tokens.accent,
    '--portal-accent-rgb': theme.accent_rgb_csv,
    '--portal-text': theme.tokens.text,
    '--portal-text-rgb': textRgb,
    '--portal-text-muted': theme.tokens.text_muted,
    '--portal-text-inverse': theme.tokens.text_inverse,
    '--portal-text-inverse-rgb': textInverseRgb,
    '--portal-bg-page': theme.tokens.bg_page,
    '--portal-bg-page-rgb': bgPageRgb,
    '--portal-bg-surface': theme.tokens.bg_surface,
    '--portal-bg-surface-rgb': bgSurfaceRgb,
    '--portal-border': theme.tokens.border,
    '--portal-border-rgb': borderRgb,
    '--sp-accent': theme.tokens.accent,
    '--sp-accent-rgb': theme.accent_rgb_csv,
    '--accentRed': theme.tokens.accent,
    '--accentRgb': theme.accent_rgb_csv,
    '--fg': theme.tokens.text,
    '--muted': theme.tokens.text_muted,
    '--bg': theme.tokens.bg_page,
    '--panel': theme.tokens.bg_surface,
    '--border': theme.tokens.border,
  };
}
