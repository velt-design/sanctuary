import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { GeometryPlanViewModel } from '@sp/geometry';
import { useFurnitureLayout } from './useFurnitureLayout';
import { studioFurnitureLayout, type FurniturePlacement } from './studioFurnitureLayout';

it('keeps furniture still through rapid sizing, settles the latest size and removes pieces that no longer fit', async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const root = createRoot(document.createElement('div'));
  let layout: FurniturePlacement[] = [];
  function Harness({ width, depth = 3000 }: { width: number; depth?: number }) {
    layout = useFurnitureLayout({ extents: { minX: 0, minY: 0, maxX: width, maxY: depth }, members: { posts: [] } } as unknown as GeometryPlanViewModel);
    return null;
  }
  try {
    await React.act(async () => root.render(<Harness width={6000}/>));
    const original = layout;
    await React.act(async () => root.render(<Harness width={6100}/>));
    expect(layout).toBe(original);
    await React.act(async () => vi.advanceTimersByTime(150));
    await React.act(async () => root.render(<Harness width={10000} depth={6000}/>));
    await React.act(async () => vi.advanceTimersByTime(219));
    expect(layout).toBe(original);
    await React.act(async () => vi.advanceTimersByTime(1));
    expect(layout).toEqual(studioFurnitureLayout({ minX: 0, minY: 0, maxX: 10000, maxY: 6000 }));
    const settled = layout;
    await React.act(async () => root.render(<Harness width={10000} depth={6000}/>));
    expect(layout).toBe(settled);
    await React.act(async () => root.render(<Harness width={1500} depth={1500}/>));
    expect(layout).toEqual([]);
    await React.act(async () => vi.advanceTimersByTime(220));
    expect(layout).toEqual([]);
  } finally { await React.act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
