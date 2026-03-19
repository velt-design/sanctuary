import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchPointer, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
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

function readWidthVar(element: HTMLElement, name: '--project-page-left-width' | '--project-page-right-width'): string {
  return element.style.getPropertyValue(name);
}

describe('ProjectPageShell resize handles', () => {
  const restoreGeometry = installDomGeometryMock();
  const originalResizeObserver = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const originalPointerEvent = (globalThis as { PointerEvent?: typeof PointerEvent }).PointerEvent;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: originalResizeObserver,
    });
    Object.defineProperty(globalThis, 'PointerEvent', {
      configurable: true,
      value: originalPointerEvent,
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

  it('changes only the left rail width when the left handle is dragged', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const leftHandle = rendered.container.querySelector('[aria-label="Resize left project rail"]') as HTMLButtonElement;

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');

    dispatchPointer(leftHandle, 'pointerdown', { button: 0, clientX: 500 });
    dispatchPointer(window, 'pointermove', { clientX: 560 });
    dispatchPointer(window, 'pointerup', { clientX: 560 });

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('340px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');

    rendered.unmount();
  });

  it('changes only the right rail width when the right handle is dragged', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const rightHandle = rendered.container.querySelector('[aria-label="Resize right project rail"]') as HTMLButtonElement;

    dispatchPointer(rightHandle, 'pointerdown', { button: 0, clientX: 1000 });
    dispatchPointer(window, 'pointermove', { clientX: 940 });
    dispatchPointer(window, 'pointerup', { clientX: 940 });

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('380px');

    rendered.unmount();
  });

  it('disables resize handles in the stacked mobile layout', () => {
    setProjectPageShellWidth(1200);
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);

    expect(rendered.container.querySelector('[aria-label="Resize left project rail"]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Resize right project rail"]')).toBeNull();

    rendered.unmount();
  });
});
