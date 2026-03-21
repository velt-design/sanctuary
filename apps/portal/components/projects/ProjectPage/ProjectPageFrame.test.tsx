import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchPointer, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
import ProjectPageFrame from './ProjectPageFrame';
import { PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY } from './useProjectHeaderLayout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({
    role: 'admin',
  }),
}));

vi.mock('@/components/ui/toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/repo/projectsRepo', () => ({
  deleteProject: vi.fn(),
}));

vi.mock('./ProjectPipelineBar', () => ({
  default: () => <div data-testid="mock-pipeline">Pipeline</div>,
}));

vi.mock('./ProjectPageShell', () => ({
  default: () => <section data-testid="mock-project-shell">Shell</section>,
}));

const snapshot = {
  project: {
    id: 'proj_123',
    name: 'Test project',
    stage: 'lead',
    contactName: 'Alex',
    region: 'North',
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

describe('ProjectPageFrame masthead layout', () => {
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

  it('defaults to the expanded masthead on desktop', () => {
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;

    expect(frame.dataset.projectMastheadMode).toBe('expanded');
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Projects');
    expect(rendered.container.textContent).toContain('Delete project');

    rendered.unmount();
  });

  it('restores a stored compact masthead and hides actions and pipeline', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        mode: 'compact',
        lastOpenMode: 'compact',
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;

    expect(frame.dataset.projectMastheadMode).toBe('compact');
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('Projects');
    expect(rendered.container.textContent).not.toContain('Delete project');
    expect(rendered.container.textContent).toContain('Test project');
    expect(rendered.container.textContent?.toLowerCase()).toContain('lead');

    rendered.unmount();
  });

  it('renders a collapsed strip and restores the last open mode from click', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        mode: 'collapsed',
        lastOpenMode: 'compact',
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;
    const collapsedStrip = rendered.container.querySelector('[data-project-masthead-collapsed="true"]') as HTMLButtonElement;

    expect(frame.dataset.projectMastheadMode).toBe('collapsed');
    expect(collapsedStrip.getAttribute('aria-expanded')).toBe('false');
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).toBeNull();

    dispatchPointer(collapsedStrip, 'click');

    expect(frame.dataset.projectMastheadMode).toBe('compact');
    expect(rendered.container.querySelector('[data-project-masthead-collapsed="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).toBeNull();

    rendered.unmount();
  });

  it('snaps from expanded to compact and collapsed while dragging upward', () => {
    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;
    const handle = rendered.container.querySelector('[data-project-masthead-handle="true"]') as HTMLElement;

    dispatchPointer(handle, 'pointerdown', { button: 0, clientY: 320 });
    dispatchPointer(window, 'pointermove', { clientY: 276 });
    expect(frame.dataset.projectMastheadMode).toBe('compact');

    dispatchPointer(window, 'pointermove', { clientY: 220 });
    expect(frame.dataset.projectMastheadMode).toBe('collapsed');

    dispatchPointer(window, 'pointerup', { clientY: 220 });
    expect(frame.dataset.projectMastheadMode).toBe('collapsed');

    rendered.unmount();
  });

  it('snaps from collapsed to compact and expanded while dragging downward', () => {
    window.localStorage.setItem(
      PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        mode: 'collapsed',
        lastOpenMode: 'compact',
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;
    const handle = rendered.container.querySelector('[data-project-masthead-handle="true"]') as HTMLElement;

    dispatchPointer(handle, 'pointerdown', { button: 0, clientY: 220 });
    dispatchPointer(window, 'pointermove', { clientY: 264 });
    expect(frame.dataset.projectMastheadMode).toBe('compact');

    dispatchPointer(window, 'pointermove', { clientY: 324 });
    expect(frame.dataset.projectMastheadMode).toBe('expanded');

    dispatchPointer(window, 'pointerup', { clientY: 324 });
    expect(frame.dataset.projectMastheadMode).toBe('expanded');
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).not.toBeNull();

    rendered.unmount();
  });

  it('keeps the current header behavior on smaller layouts', () => {
    setProjectPageShellWidth(1200);
    window.localStorage.setItem(
      PROJECT_PAGE_HEADER_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        mode: 'collapsed',
        lastOpenMode: 'compact',
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageFrame snapshot={snapshot as any} tab="estimates" />);
    const frame = rendered.container.querySelector('[data-project-page-frame="true"]') as HTMLElement;

    expect(frame.dataset.projectMastheadMode).toBe('expanded');
    expect(rendered.container.querySelector('[data-project-masthead-handle="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-masthead-collapsed="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-pipeline"]')).not.toBeNull();

    rendered.unmount();
  });
});
