import { PORTAL_THEME_OVERRIDE_KEYS } from './types';
import { hexToRgbCsv, normalizeHexColor } from './utils';
import type { PortalResolvedTheme, PortalThemeTokens } from './types';

const PORTAL_THEME_CACHE_PREFIX = 'sanctuary-portal:theme:v1:';

type CachedPortalTheme = Pick<PortalResolvedTheme, 'tokens' | 'accent_rgb_csv'>;
type ThemeReadStorage = Pick<Storage, 'getItem' | 'removeItem'>;
type ThemeWriteStorage = Pick<Storage, 'setItem'>;

export function portalThemeBrowserCacheKey(ownerId: string): string {
  const normalizedOwner = ownerId.trim();
  if (!normalizedOwner) throw new Error('A portal user id is required for theme storage.');
  return `${PORTAL_THEME_CACHE_PREFIX}${normalizedOwner}`;
}

function parseCachedPortalTheme(value: unknown): CachedPortalTheme | null {
  if (!value || typeof value !== 'object') return null;
  const rawTokens = (value as { tokens?: unknown }).tokens;
  if (!rawTokens || typeof rawTokens !== 'object') return null;

  const tokens = {} as PortalThemeTokens;
  for (const key of PORTAL_THEME_OVERRIDE_KEYS) {
    const normalized = normalizeHexColor((rawTokens as Record<string, unknown>)[key]);
    if (!normalized) return null;
    tokens[key] = normalized;
  }

  const accentRgb = hexToRgbCsv(tokens.accent);
  return accentRgb ? { tokens, accent_rgb_csv: accentRgb } : null;
}

export function readCachedPortalTheme(
  ownerId: string,
  storage?: ThemeReadStorage | null,
): CachedPortalTheme | null {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try {
      resolvedStorage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return null;
    }
  }
  if (!resolvedStorage) return null;
  const key = portalThemeBrowserCacheKey(ownerId);
  const removeInvalidEntry = () => {
    try {
      resolvedStorage.removeItem(key);
    } catch {
      // Storage can be blocked independently of reads (private mode / policy).
    }
  };
  try {
    const raw = resolvedStorage.getItem(key);
    if (!raw) return null;
    const parsed = parseCachedPortalTheme(JSON.parse(raw));
    if (!parsed) removeInvalidEntry();
    return parsed;
  } catch {
    removeInvalidEntry();
    return null;
  }
}

export function writeCachedPortalTheme(
  ownerId: string,
  theme: Pick<PortalResolvedTheme, 'tokens' | 'accent_rgb_csv'>,
  storage?: ThemeWriteStorage | null,
): void {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try {
      resolvedStorage = typeof window === 'undefined' ? null : window.localStorage;
    } catch {
      return;
    }
  }
  if (!resolvedStorage) return;
  const parsed = parseCachedPortalTheme(theme);
  if (!parsed) return;
  try {
    resolvedStorage.setItem(portalThemeBrowserCacheKey(ownerId), JSON.stringify(parsed));
  } catch {
    // A theme preference must never break portal rendering when storage is blocked.
  }
}
