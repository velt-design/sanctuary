import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  buildEstimateDrawingModuleInfoRows,
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
      moduleTitle: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      drawingTitle: 'M1 - Gable - 4.6m x 5.1m - Acrylic - Roof Plan',
      siteAddress: '16 Te Ara Oneone, Te Arai South',
      sheetCode: 'P-01',
      revision: 'V3',
      scale: DEFAULT_ESTIMATE_DRAWING_SCALE,
      date: '14/01/2026',
      client: 'Chanel',
      issue: 'Portal preview',
      note: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
      moduleInfoRows: [],
    });
  });

  it('falls back to project name and defaults when estimate details are missing', () => {
    const meta = buildEstimateDrawingSheetMeta({
      view: 'section',
      projectName: 'Millwater',
      estimateDate: 'not-a-date',
    });

    expect(meta.moduleTitle).toBe('Module');
    expect(meta.drawingTitle).toBe('Module - Section');
    expect(meta.siteAddress).toBe('Millwater');
    expect(meta.sheetCode).toBe('S-01');
    expect(meta.revision).toBe('V-');
    expect(meta.date).toBe('-');
    expect(meta.client).toBe('Not set');
    expect(meta.moduleInfoRows).toEqual([]);
  });

  it('applies title and note overrides without changing the generated suffix', () => {
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Gable - 4.6m x 5.1m - Acrylic',
      moduleTitleOverride: 'Custom client title',
      noteOverride: 'Custom note',
      view: 'section',
    });

    expect(meta.moduleTitle).toBe('Custom client title');
    expect(meta.drawingTitle).toBe('Custom client title - Section');
    expect(meta.note).toBe('Custom note');
  });
});

describe('buildEstimateDrawingModuleInfoRows', () => {
  it('builds the default v1 module info rows', () => {
    expect(
      buildEstimateDrawingModuleInfoRows({
        pergolaStyle: 'gable',
        roofMaterial: 'acrylic',
        extrusionColour: 'White',
        houseConnectionType: 'fascia',
        postConnectionType: 'slab_anchors',
        postCount: '2',
        overhangEnabled: false,
        overhangAmountM: '0',
        lengthM: '4.6',
        projectionM: '5.1',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
      } as any),
    ).toEqual([
      { label: 'Style', value: 'Gable' },
      { label: 'Roof material', value: 'Acrylic' },
      { label: 'Colour', value: 'White' },
      { label: 'House connection', value: 'Fascia' },
      { label: 'Post connection', value: 'Slab Anchors' },
      { label: 'Posts', value: '2' },
    ]);
  });

  it('adds conditional overhang and hip-corner rows when relevant', () => {
    expect(
      buildEstimateDrawingModuleInfoRows({
        pergolaStyle: 'hip_corner',
        roofMaterial: 'mixed_acrylic_timber',
        extrusionColour: 'Sand',
        houseConnectionType: 'soffit',
        postConnectionType: 'core_drill',
        postCount: '3',
        overhangEnabled: true,
        overhangAmountM: '0.25',
        lengthM: '4.6',
        projectionM: '5.1',
        hipCornerLengthBM: '3.2',
        hipCornerProjectionBM: '2.4',
      } as any),
    ).toEqual([
      { label: 'Style', value: 'Hip Corner' },
      { label: 'Roof material', value: 'Combination' },
      { label: 'Colour', value: 'Sand' },
      { label: 'House connection', value: 'Soffit' },
      { label: 'Post connection', value: 'Core Drill' },
      { label: 'Posts', value: '3' },
      { label: 'Overhang', value: '0.25m' },
      { label: 'Hip corner B', value: '3.2m x 2.4m' },
    ]);
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
