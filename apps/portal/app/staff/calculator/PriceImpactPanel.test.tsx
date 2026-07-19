import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import PriceImpactPanel from './PriceImpactPanel';
import type { ImpactDiff } from './diff';

const diff: ImpactDiff = {
  delta: {
    total_ex: 100,
    total_inc: 115,
    materials_ex: 40,
    install_ex: 30,
    overhead_ex: 30,
    crew_hours: 2,
    install_days: 1,
  },
  materialsDrivers: [{ id: 'roof', label: 'Roof sheets', prev: 100, next: 140, delta: 40 }],
  installDrivers: [{ id: 'install', label: 'Install roof', prev: 60, next: 90, delta: 30 }],
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('PriceImpactPanel', () => {
  it('keeps Reset baseline as a component-owned header action', () => {
    const onResetBaseline = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <PriceImpactPanel diff={null} isAdvancedUi={false} onResetBaseline={onResetBaseline} />,
    );

    const button = container.querySelector('button');
    expect(button?.textContent).toBe('Reset baseline');
    expect(container.querySelector('h2')?.getAttribute('style')).toBeNull();
    expect(container.textContent).toContain('No baseline yet. Make a change to see deltas.');
    act(() => button?.click());
    expect(onResetBaseline).toHaveBeenCalledOnce();
    unmount();
  });

  it('shows compact deltas and reserves driver detail for Advanced mode', () => {
    const basic = renderIntoDocument(
      <PriceImpactPanel diff={diff} isAdvancedUi={false} onResetBaseline={vi.fn()} />,
    );
    expect(basic.container.textContent).toContain('True cost change (inc GST)+$115.00');
    expect(basic.container.textContent).toContain('Ex GST +$100.00');
    expect(basic.container.textContent).toContain('Materials+$40.00');
    expect(basic.container.textContent).toContain('Install+$30.00');
    expect(basic.container.textContent).toContain('Overhead+$30.00');
    expect(basic.container.textContent).toContain('Crew hours+2 h');
    expect(basic.container.textContent).toContain('Install days+1 d');
    expect(basic.container.textContent).not.toContain('Top materials changes');
    basic.unmount();

    const advanced = renderIntoDocument(
      <PriceImpactPanel diff={diff} isAdvancedUi onResetBaseline={vi.fn()} />,
    );
    expect(advanced.container.textContent).toContain('Top materials changes');
    expect(advanced.container.textContent).toContain('Roof sheets+$40.00');
    expect(advanced.container.textContent).toContain('Install roof+30 min');
    advanced.unmount();
  });

  it('uses a quiet empty-change state while retaining operational metrics', () => {
    const unchanged: ImpactDiff = {
      delta: {
        total_ex: 0,
        total_inc: 0,
        materials_ex: 0,
        install_ex: 0,
        overhead_ex: 0,
        crew_hours: 0,
        install_days: 0,
      },
      materialsDrivers: [],
      installDrivers: [],
    };
    const { container, unmount } = renderIntoDocument(
      <PriceImpactPanel diff={unchanged} isAdvancedUi={false} onResetBaseline={vi.fn()} />,
    );

    expect(container.textContent).toContain('No cost change from baseline.');
    expect(container.textContent).toContain('Crew hours0 h');
    expect(container.textContent).toContain('Install days0 d');
    expect(container.querySelector('[aria-label="Largest cost changes"]')).toBeNull();
    unmount();
  });
});
