import { describe, expect, it } from 'vitest';
import { PREMIUM_MODULE_DRAWING_THEME, moduleDrawingThemeCssVariables } from './moduleDrawing';

describe('moduleDrawingThemeCssVariables', () => {
  it('exposes the premium drawing palette for calculator cards', () => {
    const vars = moduleDrawingThemeCssVariables('card') as Record<string, string>;

    expect(vars['--mv-line-primary']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.inkStrong);
    expect(vars['--mv-line-secondary']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.inkMid);
    expect(vars['--mv-line-major-width']).toBe(PREMIUM_MODULE_DRAWING_THEME.line.majorWidth);
    expect(vars['--mv-stage-bg']).toContain('linear-gradient');
  });

  it('keeps bare surfaces transparent while preserving shared line tokens', () => {
    const minimalVars = moduleDrawingThemeCssVariables('minimal') as Record<string, string>;
    const sheetVars = moduleDrawingThemeCssVariables('sheet') as Record<string, string>;

    expect(minimalVars['--mv-stage-border']).toBe('transparent');
    expect(minimalVars['--mv-svg-bg']).toBe('transparent');
    expect(sheetVars['--mv-sheet-border']).toBeTruthy();
    expect(sheetVars['--mv-line-hidden']).toBe(PREMIUM_MODULE_DRAWING_THEME.color.ghostLine);
  });
});
