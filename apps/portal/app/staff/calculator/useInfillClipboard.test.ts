import { describe, expect, it } from 'vitest';

import { makeDefaultInfillItem } from './calculatorInputs';
import { updateEdgeConfirmation } from './infillSupportPresentation';
import { buildInfillGeometryClipboard, buildInfillGeometryPastePatch } from './useInfillClipboard';

describe('infill geometry clipboard', () => {
  it('pastes geometry without replacing the target support confirmations', () => {
    const source = makeDefaultInfillItem({
      shape: { type: 'rect', widthM: '2.4', heightM: '2.1', bottomOffsetM: '0' },
      panelOrientation: 'vertical',
    });
    const target = makeDefaultInfillItem();
    target.support = updateEdgeConfirmation(target.support, 'top', 'yes');

    const patch = buildInfillGeometryPastePatch(buildInfillGeometryClipboard(source));
    const merged = { ...target, ...patch };

    expect(patch).not.toHaveProperty('support');
    expect(merged.shape).toMatchObject({ widthM: '2.4', heightM: '2.1' });
    expect(merged.support.edgeConfirmations).toEqual({ top: 'yes', bottom: 'no', left: 'no', right: 'no' });
  });
});
