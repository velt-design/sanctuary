import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
import ProjectPageShell from './ProjectPageShell';
import { PROJECT_PAGE_LAYOUT_STORAGE_KEY } from './useProjectColumnLayout';
import { PROJECT_PANEL_LAYOUT_STORAGE_KEY } from './useProjectPanelSlots';

vi.mock('./ProjectDetailsSidebar', () => ({
  default: () => <section data-testid="mock-details-panel">Details panel</section>,
}));

vi.mock('./ProjectTasksSidebar', () => ({
  default: () => <section data-testid="mock-tasks-panel">Tasks panel</section>,
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

  it('supports keyboard moves through the drag handle', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const tasksHandle = rendered.container.querySelector('[aria-label="Drag Project tasks"]') as HTMLButtonElement;

    dispatchKeyboard(tasksHandle, 'ArrowLeft');

    expect(railPanels(rendered.container, 'left')).toEqual(['tasks']);
    expect(railPanels(rendered.container, 'right')).toEqual(['details']);

    rendered.unmount();
  });

  it('renders a persisted stacked rail without dropping either panel', () => {
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: ['details', 'tasks'],
        right: [],
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const leftRail = rendered.container.querySelector('[data-project-rail="left"]') as HTMLElement;
    const rightRail = rendered.container.querySelector('[data-project-rail="right"]') as HTMLElement;

    expect(leftRail.dataset.panelCount).toBe('2');
    expect(railPanels(rendered.container, 'left')).toEqual(['details', 'tasks']);
    expect(rightRail.dataset.panelCount).toBe('0');
    expect(railPanels(rendered.container, 'right')).toEqual([]);

    rendered.unmount();
  });

  it('re-expands a collapsed rail when a panel is moved onto it from the keyboard', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftWidthPx: 280,
        rightWidthPx: 320,
        leftCollapsed: true,
        rightCollapsed: false,
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const tasksHandle = rendered.container.querySelector('[aria-label="Drag Project tasks"]') as HTMLButtonElement;
    const leftRail = rendered.container.querySelector('[data-project-rail="left"]') as HTMLElement;

    expect(leftRail.dataset.collapsed).toBe('true');

    dispatchKeyboard(tasksHandle, 'ArrowLeft');

    expect(leftRail.dataset.collapsed).toBeUndefined();
    expect(railPanels(rendered.container, 'left')).toEqual(['tasks']);
    expect(railPanels(rendered.container, 'right')).toEqual(['details']);

    rendered.unmount();
  });

  it('only lets the drag handle trigger keyboard panel moves', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const tasksContent = rendered.container.querySelector('[data-testid="mock-tasks-panel"]') as HTMLElement;
    const tasksHandle = rendered.container.querySelector('[aria-label="Drag Project tasks"]') as HTMLButtonElement;

    dispatchKeyboard(tasksContent, 'ArrowLeft');
    expect(railPanels(rendered.container, 'left')).toEqual(['details']);
    expect(railPanels(rendered.container, 'right')).toEqual(['tasks']);

    dispatchKeyboard(tasksHandle, 'ArrowLeft');
    expect(railPanels(rendered.container, 'left')).toEqual(['tasks']);
    expect(railPanels(rendered.container, 'right')).toEqual(['details']);

    rendered.unmount();
  });
});
