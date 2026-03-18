import { describe, expect, it } from 'vitest';
import { resolvePortalTheme } from './resolve';

describe('resolvePortalTheme', () => {
  it('resolves to default system preset when no input is provided', () => {
    const theme = resolvePortalTheme();
    expect(theme.preset_id).toBe('stone-olive');
    expect(theme.active_preset_kind).toBe('system');
    expect(theme.active_preset_id).toBe('stone-olive');
    expect(theme.user_preset_id).toBeNull();
    expect(theme.tokens.accent).toBe('#4F5748');
  });

  it('uses user preset tokens when a valid user preset is provided', () => {
    const theme = resolvePortalTheme({
      preset_id: 'sanctuary-burgundy',
      user_preset: {
        id: 'preset_1',
        name: 'My Slate',
        tokens: {
          accent: '#112233',
          text: '#141414',
          text_muted: '#555555',
          text_inverse: '#FFFFFF',
          bg_page: '#EFEFEF',
          bg_surface: '#F8F8F8',
          border: '#DDDDDD',
        },
      },
    });

    expect(theme.active_preset_kind).toBe('user');
    expect(theme.user_preset_id).toBe('preset_1');
    expect(theme.active_preset_id).toBe('preset_1');
    expect(theme.active_preset_label).toBe('My Slate');
    expect(theme.tokens.accent).toBe('#112233');
  });

  it('retains system preset_id while using user preset as active selection', () => {
    const theme = resolvePortalTheme({
      preset_id: 'stone-olive',
      user_preset: {
        id: 'preset_custom_42',
        name: 'Custom Olive',
        tokens: {
          accent: '#223344',
          text: '#111111',
          text_muted: '#666666',
          text_inverse: '#FFFFFF',
          bg_page: '#EFEFEF',
          bg_surface: '#F7F7F7',
          border: '#D9D9D9',
        },
      },
    });

    expect(theme.preset_id).toBe('stone-olive');
    expect(theme.active_preset_kind).toBe('user');
    expect(theme.user_preset_id).toBe('preset_custom_42');
    expect(theme.active_preset_id).toBe('preset_custom_42');
  });

  it('falls back to system preset when user preset tokens are invalid', () => {
    const theme = resolvePortalTheme({
      preset_id: 'stone-olive',
      user_preset: {
        id: 'preset_bad',
        name: 'Bad preset',
        tokens: {
          accent: 'not-a-color',
        },
      },
    });

    expect(theme.active_preset_kind).toBe('system');
    expect(theme.user_preset_id).toBeNull();
    expect(theme.active_preset_id).toBe('stone-olive');
    expect(theme.tokens.accent).toBe('#4F5748');
  });

  it('applies overrides on top of selected user preset', () => {
    const theme = resolvePortalTheme({
      user_preset: {
        id: 'preset_2',
        name: 'Custom',
        tokens: {
          accent: '#010203',
          text: '#111111',
          text_muted: '#666666',
          text_inverse: '#FFFFFF',
          bg_page: '#EEEEEE',
          bg_surface: '#FAFAFA',
          border: '#DADADA',
        },
      },
      overrides: {
        accent: '#ABCDEF',
      },
    });

    expect(theme.active_preset_kind).toBe('user');
    expect(theme.tokens.accent).toBe('#ABCDEF');
    expect(theme.is_customized).toBe(true);
  });

  it('resolves the monochrome system preset by id', () => {
    const theme = resolvePortalTheme({ preset_id: 'monochrome' });

    expect(theme.preset_id).toBe('monochrome');
    expect(theme.active_preset_kind).toBe('system');
    expect(theme.active_preset_id).toBe('monochrome');
    expect(theme.tokens.accent).toBe('#333333');
    expect(theme.tokens.bg_page).toBe('#D9D9D9');
  });
});
