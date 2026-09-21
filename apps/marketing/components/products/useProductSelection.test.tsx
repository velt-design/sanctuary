import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useProductSelection } from './useProductSelection';
import type { ProductDesignType } from './productDesigns';

it('restores each product independently and preserves the existing pitched storage key', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  const root = createRoot(document.createElement('div'));
  let current!: ReturnType<typeof useProductSelection>;
  function Harness({ type }: { type: ProductDesignType }) { current = useProductSelection(type); return null; }
  const show = (type: ProductDesignType) => React.act(async () => root.render(<Harness key={type} type={type}/>));
  try {
    await show('pitched');
    await React.act(async () => current.update({ widthMm: 7400, material: 'solid', sides: 'left' }));
    expect(sessionStorage.getItem('sanctuary:pitched-product:v1')).toContain('7400');
    await show('gable');
    expect(current.selection.widthMm).toBe(6000);
    await React.act(async () => current.update({ widthMm: 8200, material: 'combination', sides: 'right' }));
    await show('box-perimeter');
    expect(current.selection.material).toBe('acrylic');
    await React.act(async () => current.update({ projectionMm: 4100 }));
    await show('gable');
    expect(current.selection).toMatchObject({ widthMm: 8200, material: 'combination', sides: 'right' });
    await show('pitched');
    expect(current.selection).toMatchObject({ widthMm: 7400, material: 'solid', sides: 'left' });
    await show('box-perimeter');
    expect(current.selection.projectionMm).toBe(4100);
    await React.act(async () => current.update({ projectionMm: 6000 }));
    await React.act(async () => current.update({ material: 'solid' }));
    expect(current.selection.projectionMm).toBeLessThan(6000);
    expect(current.selection.projectionMm).toBe(current.projectionMax);
    expect(current.adjustment).toContain('Projection adjusted');
    const constrained = current.selection.projectionMm;
    await show('gable'); await show('box-perimeter');
    expect(current.selection.projectionMm).toBe(constrained);
  } finally { await React.act(async () => root.unmount()); sessionStorage.clear(); vi.unstubAllGlobals(); }
});
