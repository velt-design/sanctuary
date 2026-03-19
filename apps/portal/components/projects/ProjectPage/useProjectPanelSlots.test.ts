import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import {
  PROJECT_PANEL_LAYOUT_STORAGE_KEY,
  keyboardMoveProjectPanel,
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

  it('normalizes to the default one-per-side layout', () => {
    expect(normalizeProjectPanelSlots(null)).toEqual({
      left: ['details'],
      right: ['tasks'],
    });
  });

  it('moves tasks from the right rail into a left-side stack', () => {
    const next = moveProjectPanel(
      {
        left: ['details'],
        right: ['tasks'],
      },
      {
        panelId: 'tasks',
        rail: 'left',
        index: 1,
      },
    );

    expect(next).toEqual({
      left: ['details', 'tasks'],
      right: [],
    });
  });

  it('moves details from the left rail into a right-side stack', () => {
    const next = moveProjectPanel(
      {
        left: ['details'],
        right: ['tasks'],
      },
      {
        panelId: 'details',
        rail: 'right',
        index: 1,
      },
    );

    expect(next).toEqual({
      left: [],
      right: ['tasks', 'details'],
    });
  });

  it('swaps one-per-side panels through the keyboard move helper', () => {
    const next = keyboardMoveProjectPanel(
      {
        left: ['details'],
        right: ['tasks'],
      },
      'tasks',
      'left',
    );

    expect(next).toEqual({
      left: ['tasks'],
      right: ['details'],
    });
  });

  it('normalizes invalid persisted layouts back to a safe state', () => {
    expect(
      normalizeProjectPanelSlots({
        left: ['details', 'details', 'oops'],
        right: ['tasks', 'ghost'],
      }),
    ).toEqual({
      left: ['details'],
      right: ['tasks'],
    });
  });

  it('restores persisted slots on remount', () => {
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: ['tasks'],
        right: ['details'],
      }),
    );

    const firstRender = renderIntoDocument(createElement(PanelSlotsHarness));
    const firstState = firstRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(firstState.dataset.left).toBe('tasks');
    expect(firstState.dataset.right).toBe('details');
    firstRender.unmount();

    const secondRender = renderIntoDocument(createElement(PanelSlotsHarness));
    const secondState = secondRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(secondState.dataset.left).toBe('tasks');
    expect(secondState.dataset.right).toBe('details');

    secondRender.unmount();
  });
});
