import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  buildEstimateDrawingSheetMeta,
  formatEstimateDrawingScale,
  getEstimateDrawingScaleOptions,
  parseEstimateDrawingScaleKey,
} from './drawingSheet';

describe('buildEstimateDrawingSheetMeta', () => {
  it('builds plan metadata from estimate and project details', () => {
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      view: 'plan',
      versionLabel: 'V3',
      estimateDate: '2026-01-14T09:30:00.000Z',
      projectName: 'Millwater',
      siteAddress: '16 Te Ara Oneone, Te Arai South',
      clientName: 'Chanel',
    });

    expect(meta).toEqual({
      drawingTitle: 'M1 - Gable - 4.6m x 5.1m - Acrylic - Roof Plan',
      siteAddress: '16 Te Ara Oneone, Te Arai South',
      sheetCode: 'P-01',
      revision: 'V3',
      scale: DEFAULT_ESTIMATE_DRAWING_SCALE,
      date: '14/01/2026',
      client: 'Chanel',
      issue: 'Portal preview',
      note: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
    });
  });

  it('falls back to project name and defaults when estimate details are missing', () => {
    const meta = buildEstimateDrawingSheetMeta({
      view: 'section',
      projectName: 'Millwater',
      estimateDate: 'not-a-date',
    });

    expect(meta.drawingTitle).toBe('Module - Section');
    expect(meta.siteAddress).toBe('Millwater');
    expect(meta.sheetCode).toBe('S-01');
    expect(meta.revision).toBe('V-');
    expect(meta.date).toBe('-');
    expect(meta.client).toBe('Not set');
  });
});

describe('drawing scale helpers', () => {
  it('formats fit and fixed drawing scales for sheet metadata', () => {
    expect(formatEstimateDrawingScale({ mode: 'fit' })).toBe('NTS');
    expect(formatEstimateDrawingScale({ mode: 'fixed', ratio: 50 })).toBe('1:50');
  });

  it('parses persisted scale keys and exposes view-specific options', () => {
    expect(parseEstimateDrawingScaleKey('fit')).toEqual({ mode: 'fit' });
    expect(parseEstimateDrawingScaleKey('1:25')).toEqual({ mode: 'fixed', ratio: 25 });
    expect(getEstimateDrawingScaleOptions('plan')).toEqual([
      { mode: 'fit' },
      { mode: 'fixed', ratio: 20 },
      { mode: 'fixed', ratio: 25 },
      { mode: 'fixed', ratio: 50 },
      { mode: 'fixed', ratio: 100 },
    ]);
    expect(getEstimateDrawingScaleOptions('section')).toEqual([
      { mode: 'fit' },
      { mode: 'fixed', ratio: 10 },
      { mode: 'fixed', ratio: 20 },
      { mode: 'fixed', ratio: 25 },
      { mode: 'fixed', ratio: 50 },
    ]);
  });
});
