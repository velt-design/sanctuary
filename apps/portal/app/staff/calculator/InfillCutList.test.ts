import { describe, expect, it } from 'vitest';
import { cutListRowsToCsv } from './InfillCutList';
import type { CutListRow } from './infillCompute';

describe('cutListRowsToCsv', () => {
  it('exports the same canonical piece and purchase records shown in the calculator', () => {
    const rows: CutListRow[] = [
      {
        group: 'piece',
        pieceType: 'panel',
        role: 'rectangle',
        part: 'Acrylic panel 1',
        qty: 1,
        lengthM: 2.1,
        finishedWidthM: 1.2,
        finishedHeightM: 2.1,
        pieceId: 'module-1.infill-1.i1.panel1',
        sourceInfillId: 'infill-1',
        allocatedStock: '3.050m × 2.030m stock #1',
        notes: 'rectangle; sheet panel.',
      },
      {
        group: 'purchase',
        pieceType: 'stock',
        role: 'acrylic_sheet',
        part: 'Plexi sheet 3050 × 2030',
        qty: 2,
        lengthM: 3.05,
        finishedWidthM: 2.03,
        pieceId: 'infill.acrylic_sheet_clear',
        sourceInfillId: 'infill-1',
        allocatedStock: 'stock #1; stock #2',
        notes: '2 allocated cut(s).',
      },
    ];

    expect(cutListRowsToCsv(rows)).toBe([
      'Group,Piece type,Role,Part,Qty,Cut length,Finished width,Finished height,Piece ID,Source infill,Allocated stock,Notes',
      'Pieces to cut,panel,rectangle,Acrylic panel 1,1,2.100m,1.200m,2.100m,module-1.infill-1.i1.panel1,infill-1,3.050m × 2.030m stock #1,rectangle; sheet panel.',
      'Materials to purchase,stock,acrylic_sheet,Plexi sheet 3050 × 2030,2,3.050m,2.030m,,infill.acrylic_sheet_clear,infill-1,stock #1; stock #2,2 allocated cut(s).',
    ].join('\n'));
  });
});
