'use client';

import { useEffect } from 'react';
import { applyPortalThemeToDocument } from '@/lib/theme/client';
import { readCachedPortalTheme, writeCachedPortalTheme } from '@/lib/theme/browserCache';
import { PORTAL_DEFAULT_ACCENT_RGB_CSV, PORTAL_DEFAULT_THEME_PRESET } from '@/lib/theme/presets';
import type { PortalResolvedTheme } from '@/lib/theme/types';

const DEFAULT_PORTAL_THEME = {
  tokens: PORTAL_DEFAULT_THEME_PRESET.tokens,
  accent_rgb_csv: PORTAL_DEFAULT_ACCENT_RGB_CSV,
};

export default function PortalThemeRuntime({ ownerId }: { ownerId: string }) {
  useEffect(() => {
    let active = true;
    const cached = readCachedPortalTheme(ownerId);
    applyPortalThemeToDocument(cached ?? DEFAULT_PORTAL_THEME);

    void (async () => {
      try {
        const response = await fetch('/api/staff/v1/theme', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const body = await response.json() as { theme?: PortalResolvedTheme };
        if (!active || !body.theme) return;
        applyPortalThemeToDocument(body.theme);
        writeCachedPortalTheme(ownerId, body.theme);
      } catch {
        // The cached/default theme remains usable while offline.
      }
    })();

    return () => {
      active = false;
      applyPortalThemeToDocument(DEFAULT_PORTAL_THEME);
    };
  }, [ownerId]);

  return null;
}
