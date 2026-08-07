import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PORTAL_DEFAULT_THEME_PRESET } from './presets';
import {
  portalThemeBrowserCacheKey,
  readCachedPortalTheme,
  writeCachedPortalTheme,
} from './browserCache';

describe('portal theme browser cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps a validated theme isolated to its owner', () => {
    writeCachedPortalTheme('user-a', {
      tokens: PORTAL_DEFAULT_THEME_PRESET.tokens,
      accent_rgb_csv: 'untrusted cached value',
    });

    expect(readCachedPortalTheme('user-a')).toEqual({
      tokens: PORTAL_DEFAULT_THEME_PRESET.tokens,
      accent_rgb_csv: '79, 87, 72',
    });
    expect(readCachedPortalTheme('user-b')).toBeNull();
  });

  it('removes a malformed cached theme instead of applying it', () => {
    const key = portalThemeBrowserCacheKey('user-a');
    window.localStorage.setItem(key, JSON.stringify({
      tokens: { ...PORTAL_DEFAULT_THEME_PRESET.tokens, accent: 'javascript:alert(1)' },
    }));

    expect(readCachedPortalTheme('user-a')).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('falls back safely when browser storage rejects both reads and cleanup', () => {
    const storage = {
      getItem: vi.fn(() => { throw new DOMException('Blocked', 'SecurityError'); }),
      removeItem: vi.fn(() => { throw new DOMException('Blocked', 'SecurityError'); }),
    };

    expect(readCachedPortalTheme('user-a', storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });

  it('does not break rendering when browser storage rejects a theme write', () => {
    const storage = {
      setItem: vi.fn(() => { throw new DOMException('Blocked', 'SecurityError'); }),
    };

    expect(() => writeCachedPortalTheme('user-a', {
      tokens: PORTAL_DEFAULT_THEME_PRESET.tokens,
      accent_rgb_csv: '79, 87, 72',
    }, storage)).not.toThrow();
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
});
