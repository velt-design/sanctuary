import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import {
  PROJECT_PAGE_CENTER_MIN_PX,
  PROJECT_PAGE_HANDLE_WIDTH_PX,
  PROJECT_PAGE_LAYOUT_STORAGE_KEY,
  useProjectColumnLayout,
} from './useProjectColumnLayout';
import { installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';

function ColumnLayoutHarness(): ReactElement {
  const { containerRef, isDesktopLayout, leftCollapsed, leftWidthPx, rightCollapsed, rightWidthPx, shellStyle } =
    useProjectColumnLayout();

  return createElement(
    'div',
    { ref: containerRef, 'data-project-page-shell': 'true', style: shellStyle },
      createElement('div', {
        'data-testid': 'state',
        'data-desktop': isDesktopLayout ? 'true' : 'false',
        'data-left-collapsed': leftCollapsed ? 'true' : 'false',
        'data-left': leftWidthPx,
        'data-right-collapsed': rightCollapsed ? 'true' : 'false',
        'data-right': rightWidthPx,
      }),
  );
}

describe('useProjectColumnLayout', () => {
  const restoreGeometry = installDomGeometryMock();
  const originalResizeObserver = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: originalResizeObserver,
    });
    restoreGeometry();
  });

  beforeEach(() => {
    window.localStorage.clear();
    setProjectPageShellWidth(1500);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('restores the default desktop widths when storage is empty', () => {
    const rendered = renderIntoDocument(createElement(ColumnLayoutHarness));
    const state = rendered.container.querySelector('[data-testid="state"]') as HTMLElement;

    expect(state.dataset.desktop).toBe('true');
    expect(state.dataset.leftCollapsed).toBe('false');
    expect(state.dataset.left).toBe('280');
    expect(state.dataset.rightCollapsed).toBe('false');
    expect(state.dataset.right).toBe('320');

    rendered.unmount();
  });

  it('clamps oversized stored widths on a narrow desktop shell', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftWidthPx: 420,
        rightWidthPx: 420,
      }),
    );
    setProjectPageShellWidth(1400);

    const rendered = renderIntoDocument(createElement(ColumnLayoutHarness));
    const state = rendered.container.querySelector('[data-testid="state"]') as HTMLElement;
    const leftWidthPx = Number(state.dataset.left);
    const rightWidthPx = Number(state.dataset.right);

    expect(leftWidthPx).toBeLessThan(420);
    expect(rightWidthPx).toBeLessThan(420);
    expect(leftWidthPx + rightWidthPx).toBeLessThanOrEqual(1400 - PROJECT_PAGE_CENTER_MIN_PX - PROJECT_PAGE_HANDLE_WIDTH_PX * 2);

    rendered.unmount();
  });

  it('restores stored widths and collapsed rails after remounting', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftWidthPx: 320,
        rightWidthPx: 360,
        leftCollapsed: true,
      }),
    );

    const firstRender = renderIntoDocument(createElement(ColumnLayoutHarness));
    const firstState = firstRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(firstState.dataset.leftCollapsed).toBe('true');
    expect(firstState.dataset.left).toBe('0');
    expect(firstState.dataset.rightCollapsed).toBe('false');
    expect(firstState.dataset.right).toBe('360');
    firstRender.unmount();

    const secondRender = renderIntoDocument(createElement(ColumnLayoutHarness));
    const secondState = secondRender.container.querySelector('[data-testid="state"]') as HTMLElement;
    expect(secondState.dataset.leftCollapsed).toBe('true');
    expect(secondState.dataset.left).toBe('0');
    expect(secondState.dataset.rightCollapsed).toBe('false');
    expect(secondState.dataset.right).toBe('360');

    secondRender.unmount();
  });
});
