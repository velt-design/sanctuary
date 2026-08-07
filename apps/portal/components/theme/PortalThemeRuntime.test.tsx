import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { PORTAL_DEFAULT_ACCENT_RGB_CSV, PORTAL_DEFAULT_THEME_PRESET } from '@/lib/theme/presets';

const { applyThemeMock, readThemeMock, writeThemeMock } = vi.hoisted(() => ({
  applyThemeMock: vi.fn(),
  readThemeMock: vi.fn(),
  writeThemeMock: vi.fn(),
}));

vi.mock('@/lib/theme/client', () => ({
  applyPortalThemeToDocument: (...args: unknown[]) => applyThemeMock(...args),
}));

vi.mock('@/lib/theme/browserCache', () => ({
  readCachedPortalTheme: (...args: unknown[]) => readThemeMock(...args),
  writeCachedPortalTheme: (...args: unknown[]) => writeThemeMock(...args),
}));

import PortalThemeRuntime from './PortalThemeRuntime';

const DEFAULT_THEME = {
  tokens: PORTAL_DEFAULT_THEME_PRESET.tokens,
  accent_rgb_csv: PORTAL_DEFAULT_ACCENT_RGB_CSV,
};

describe('PortalThemeRuntime', () => {
  beforeEach(() => {
    applyThemeMock.mockReset();
    readThemeMock.mockReset().mockReturnValue(null);
    writeThemeMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies a cached presentation theme without waiting for the network', () => {
    const cached = {
      tokens: { ...PORTAL_DEFAULT_THEME_PRESET.tokens, accent: '#123456' },
      accent_rgb_csv: '18, 52, 86',
    };
    readThemeMock.mockReturnValue(cached);

    const rendered = renderIntoDocument(<PortalThemeRuntime ownerId="user-a" />);

    expect(readThemeMock).toHaveBeenCalledWith('user-a');
    expect(applyThemeMock).toHaveBeenCalledWith(cached);
    rendered.unmount();
  });

  it('resets the previous owner theme on owner change and unmount', () => {
    const cached = {
      tokens: { ...PORTAL_DEFAULT_THEME_PRESET.tokens, accent: '#123456' },
      accent_rgb_csv: '18, 52, 86',
    };
    readThemeMock.mockImplementation((ownerId: string) => ownerId === 'user-a' ? cached : null);
    const rendered = renderIntoDocument(<PortalThemeRuntime ownerId="user-a" />);

    rendered.rerender(<PortalThemeRuntime ownerId="user-b" />);

    expect(applyThemeMock).toHaveBeenLastCalledWith(DEFAULT_THEME);
    rendered.unmount();
    expect(applyThemeMock).toHaveBeenLastCalledWith(DEFAULT_THEME);
  });
});
