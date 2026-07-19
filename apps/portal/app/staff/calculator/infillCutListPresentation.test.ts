import { describe, expect, it } from 'vitest';

import type { CutListRow } from './infillTakeoffPresentation';
import { buildInfillCutListDisplayRows } from './infillCutListPresentation';

const rows: CutListRow[] = [
  {
    group: 'piece', pieceType: 'panel', role: 'triangle', part: 'Acrylic panel 1', qty: 1,
    lengthM: 2.4, finishedWidthM: 2.4, finishedHeightM: 1.2,
    allocatedStock: '3.050m × 2.030m stock #1', notes: 'triangle; sheet panel.',
  },
  {
    group: 'piece', pieceType: 'linear_cut', role: 'joiner_bottom', part: 'Joiner · Bottom', qty: 1,
    lengthM: 2.4, allocatedStock: '4.000m stock #2', notes: 'Joiners',
  },
  {
    group: 'purchase', pieceType: 'stock', role: 'acrylic_sheet', part: 'Plexi sheet 3050 × 2030', qty: 1,
    lengthM: 3.05, finishedWidthM: 2.03, allocatedStock: 'stock #1',
    notes: '1 allocated cut(s); waste 3.311m².',
  },
];

describe('infill cut-list presentation', () => {
  it('separates finished dimensions and exact stock allocation for pieces', () => {
    expect(buildInfillCutListDisplayRows(rows, 'piece')).toEqual([
      expect.objectContaining({
        measurement: '2.400m × 1.200m',
        detail: 'Stock 1 · 3.050m × 2.030m',
        description: 'Triangle · sheet panel',
      }),
      expect.objectContaining({
        measurement: '2.400m',
        detail: 'Stock 2 · 4.000m',
        description: 'Joiners',
      }),
    ]);
  });

  it('presents purchase stock size and waste without changing the source row', () => {
    const source = structuredClone(rows);
    expect(buildInfillCutListDisplayRows(rows, 'purchase')).toEqual([
      expect.objectContaining({
        measurement: '3.050m × 2.030m',
        detail: '1 cut allocated · 3.311m² waste',
        description: 'Allocated to stock #1',
      }),
    ]);
    expect(rows).toEqual(source);
  });
});
