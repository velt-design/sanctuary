import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
import ProjectPageShell from './ProjectPageShell';
import { PROJECT_PANEL_LAYOUT_STORAGE_KEY } from './useProjectPanelSlots';

vi.mock('./projectDetailsModule', () => ({
  LazyProjectDetailsSidebar: () => <section data-testid="mock-details-panel">Details panel</section>,
}));

vi.mock('./ProjectMainTabs', () => ({
  default: () => <section data-testid="mock-center-panel">Center panel</section>,
}));

const snapshot = {
  project: {
    id: 'proj_123',
    name: 'Test project',
    stage: 'lead',
  },
  pipeline: {
    stage: 'lead',
  },
  tasks: {
    stage: 'lead',
    items: [],
  },
  activity: [],
  emails: [],
  notes: [],
} as const;

function railPanels(container: HTMLDivElement, rail: 'left' | 'right'): string[] {
  return Array.from(container.querySelectorAll(`[data-project-rail="${rail}"] [data-project-panel]`)).map(
    (element) => (element as HTMLElement).dataset.projectPanel ?? '',
  );
}

describe('ProjectPageShell panel dragging', () => {
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

  it('renders the details panel on the left rail by default', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);

    expect(railPanels(rendered.container, 'left')).toEqual(['details']);
    expect(railPanels(rendered.container, 'right')).toEqual([]);

    rendered.unmount();
  });

  it('filters legacy "tasks" entries out of persisted slot state on hydrate', () => {
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: ['details', 'tasks'],
        right: ['tasks'],
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const leftRail = rendered.container.querySelector('[data-project-rail="left"]') as HTMLElement;
    const rightRail = rendered.container.querySelector('[data-project-rail="right"]') as HTMLElement;

    expect(leftRail.dataset.panelCount).toBe('1');
    expect(railPanels(rendered.container, 'left')).toEqual(['details']);
    expect(rightRail.dataset.panelCount).toBe('0');
    expect(railPanels(rendered.container, 'right')).toEqual([]);

    rendered.unmount();
  });

  it('moves the details panel to the right rail through the drag handle keyboard control', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const detailsHandle = rendered.container.querySelector('[aria-label="Drag Project details"]') as HTMLButtonElement;

    dispatchKeyboard(detailsHandle, 'ArrowRight');

    expect(railPanels(rendered.container, 'left')).toEqual([]);
    expect(railPanels(rendered.container, 'right')).toEqual(['details']);

    rendered.unmount();
  });

  it('only lets the drag handle trigger keyboard panel moves', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const detailsContent = rendered.container.querySelector('[data-testid="mock-details-panel"]') as HTMLElement;
    const detailsHandle = rendered.container.querySelector('[aria-label="Drag Project details"]') as HTMLButtonElement;

    dispatchKeyboard(detailsContent, 'ArrowRight');
    expect(railPanels(rendered.container, 'left')).toEqual(['details']);
    expect(railPanels(rendered.container, 'right')).toEqual([]);

    dispatchKeyboard(detailsHandle, 'ArrowRight');
    expect(railPanels(rendered.container, 'left')).toEqual([]);
    expect(railPanels(rendered.container, 'right')).toEqual(['details']);

    rendered.unmount();
  });
});
