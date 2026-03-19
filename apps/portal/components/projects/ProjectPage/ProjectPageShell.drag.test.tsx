import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
import ProjectPageShell from './ProjectPageShell';

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
