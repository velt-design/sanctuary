'use client';

import { portalThemeCssVariables } from './cssVars';
import type { PortalResolvedTheme } from './types';

type ThemeShape = Pick<PortalResolvedTheme, 'tokens' | 'accent_rgb_csv'>;

export function applyPortalThemeToDocument(theme: ThemeShape): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = portalThemeCssVariables(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

