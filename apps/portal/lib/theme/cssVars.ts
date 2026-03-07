import type { PortalResolvedTheme } from './types';

type ThemeShape = Pick<PortalResolvedTheme, 'tokens' | 'accent_rgb_csv'>;

export function portalThemeCssVariables(theme: ThemeShape): Record<string, string> {
  return {
    '--portal-accent': theme.tokens.accent,
    '--portal-accent-rgb': theme.accent_rgb_csv,
    '--portal-text': theme.tokens.text,
    '--portal-text-muted': theme.tokens.text_muted,
    '--portal-text-inverse': theme.tokens.text_inverse,
    '--portal-bg-page': theme.tokens.bg_page,
    '--portal-bg-surface': theme.tokens.bg_surface,
    '--portal-border': theme.tokens.border,
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

