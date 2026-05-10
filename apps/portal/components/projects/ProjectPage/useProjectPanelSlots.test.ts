import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import {
  PROJECT_PANEL_LAYOUT_STORAGE_KEY,
  moveProjectPanel,
  normalizeProjectPanelSlots,
  useProjectPanelSlots,
} from './useProjectPanelSlots';
import { renderIntoDocument } from '../../../../../test/reactHarness';

function PanelSlotsHarness(): ReactElement {
  const { slots } = useProjectPanelSlots();
  return createElement('div', {
    'data-testid': 'state',
    'data-left': slots.left.join(','),
    'data-right': slots.right.join(','),
  });
}

describe('useProjectPanelSlots', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('normalizes to the default details-on-left layout', () => {
    expect(normalizeProjectPanelSlots(null)).toEqual({
      left: ['details'],
      right: [],
    });
  });

  it('moves details from the left rail into a right-side stack', () => {
    const next = moveProjectPanel(
      {
        left: ['details'],
        right: [],
      },
      {
        panelId: 'details',
        rail: 'right',
        index: 0,
      },
    );

    expect(next).toEqual({
      left: [],
      right: ['details'],
    });
  });

  it('drops legacy panel ids (e.g. tasks) when normalizing persisted state', () => {
    expect(
      normalizeProjectPanelSlots({
        left: ['details', 'tasks', 'ghost'],
        right: ['tasks'],
      }),
    ).toEqual({
      left: ['details'],
      right: [],
    });
  });

  it('restores persisted slots on remount', () => {
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: [],
        right: ['details'],
      }),
    );

    const firstRender = renderIntoDocument(createElement(PanelSlotsHarness));
    const firstState = firstRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(firstState.dataset.left).toBe('');
    expect(firstState.dataset.right).toBe('details');
    firstRender.unmount();

    const secondRender = renderIntoDocument(createElement(PanelSlotsHarness));
    const secondState = secondRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(secondState.dataset.left).toBe('');
    expect(secondState.dataset.right).toBe('details');

    secondRender.unmount();
  });
});
