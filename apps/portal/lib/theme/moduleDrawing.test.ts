import { describe, expect, it } from 'vitest';
import { PREMIUM_MODULE_DRAWING_THEME, moduleDrawingThemeCssVariables } from './moduleDrawing';

describe('moduleDrawingThemeCssVariables', () => {
  it('exposes the premium drawing palette for calculator cards', () => {
    const vars = moduleDrawingThemeCssVariables('card') as Record<string, string>;

    expect(vars['--mv-line-primary']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.inkStrong);
    expect(vars['--mv-line-secondary']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.inkMid);
    expect(vars['--mv-line-tertiary']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.inkLight);
    expect(vars['--mv-line-major-width']).toBe(PREMIUM_MODULE_DRAWING_THEME.line.majorWidth);
    expect(vars['--mv-line-secondary-width']).toBe(PREMIUM_MODULE_DRAWING_THEME.line.secondaryWidth);
    expect(vars['--mv-line-tertiary-width']).toBe(PREMIUM_MODULE_DRAWING_THEME.line.tertiaryWidth);
    expect(vars['--mv-stage-bg']).toContain('linear-gradient');
  });

  it('keeps bare surfaces transparent while preserving shared line tokens', () => {
    const minimalVars = moduleDrawingThemeCssVariables('minimal') as Record<string, string>;
    const sheetVars = moduleDrawingThemeCssVariables('sheet') as Record<string, string>;

    expect(minimalVars['--mv-stage-border']).toBe('transparent');
    expect(minimalVars['--mv-svg-bg']).toBe('transparent');
    expect(sheetVars['--mv-sheet-border']).toBeTruthy();
    expect(sheetVars['--mv-line-primary']).toBe('rgba(47, 56, 47, 0.84)');
    expect(sheetVars['--mv-line-major-width']).toBe('0.46');
    expect(sheetVars['--mv-line-secondary-width']).toBe('0.24');
    expect(sheetVars['--mv-line-tertiary-width']).toBe('0.15');
    expect(sheetVars['--mv-line-minor-width']).toBe('0.22');
    expect(sheetVars['--mv-text-dimension-size']).toBe('2.18px');
    expect(sheetVars['--mv-line-hidden']).not.toBe(PREMIUM_MODULE_DRAWING_THEME.color.ghostLine);
    expect(sheetVars['--mv-sheet-panel-border-soft']).toBeTruthy();
    expect(sheetVars['--mv-sheet-divider']).toBeTruthy();
    expect(sheetVars['--mv-line-rhythm']).toBeTruthy();
    expect(sheetVars['--mv-line-annotation']).toBeTruthy();
    expect(sheetVars['--mv-line-tertiary']).toBeTruthy();
  });
});
