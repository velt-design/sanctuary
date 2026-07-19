import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKeyboard, dispatchPointer, installDomGeometryMock, renderIntoDocument, setProjectPageShellWidth } from '../../../../../test/reactHarness';
import ProjectPageShell from './ProjectPageShell';
import { useProjectPageDesignRail } from './ProjectPageDesignRailContext';
import { PROJECT_PAGE_LAYOUT_STORAGE_KEY } from './useProjectColumnLayout';
import { PROJECT_PANEL_LAYOUT_STORAGE_KEY } from './useProjectPanelSlots';

let mockActiveTab: string = 'quotes';
let mockConfiguratorOverride = false;
let latestShowDetailsTab: boolean | undefined;

vi.mock('./projectDetailsModule', () => ({
  LazyProjectDetailsSidebar: () => <section data-testid="mock-details-panel">Details panel</section>,
}));

vi.mock('./ProjectMainTabs', () => ({
  default: (props: any) => {
    const React = require('react');
    const ReactDOM = require('react-dom');
    const { renderInShell, rightRailNode } = useProjectPageDesignRail();
    React.useEffect(() => {
      latestShowDetailsTab = props.showDetailsTab;
      props.onActiveTabChange?.(mockActiveTab);
    }, [props.onActiveTabChange, props.showDetailsTab]);
    return (
      <>
        <section data-testid="mock-center-panel" data-show-details-tab={props.showDetailsTab ? 'true' : 'false'}>Center panel</section>
        {mockConfiguratorOverride && renderInShell && rightRailNode
          ? ReactDOM.createPortal(<section data-testid="mock-configurator-rail">Configurator rail</section>, rightRailNode)
          : null}
      </>
    );
  },
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
    mockActiveTab = 'quotes';
    mockConfiguratorOverride = false;
    latestShowDetailsTab = undefined;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('changes only the left rail width when the left handle is dragged', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const leftHandle = rendered.container.querySelector('[aria-label="Resize left project rail"]') as HTMLButtonElement;

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');
    expect(latestShowDetailsTab).toBe(false);

    dispatchPointer(leftHandle, 'pointerdown', { button: 0, clientX: 500 });
    dispatchPointer(window, 'pointermove', { clientX: 560 });
    dispatchPointer(window, 'pointerup', { clientX: 560 });

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('340px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');

    rendered.unmount();
  });

  it('changes only the right rail width when the right handle is dragged', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const rightHandle = rendered.container.querySelector('[aria-label="Resize right project rail"]') as HTMLButtonElement;

    dispatchPointer(rightHandle, 'pointerdown', { button: 0, clientX: 1000 });
    dispatchPointer(window, 'pointermove', { clientX: 940 });
    dispatchPointer(window, 'pointerup', { clientX: 940 });

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('380px');

    rendered.unmount();
  });

  it('collapses the left rail after overshooting the minimum and restores its previous width when dragged back open', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const leftHandle = rendered.container.querySelector('[aria-label="Resize left project rail"]') as HTMLButtonElement;

    dispatchPointer(leftHandle, 'pointerdown', { button: 0, clientX: 500 });
    dispatchPointer(window, 'pointermove', { clientX: 180 });

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('260px');

    dispatchPointer(window, 'pointerup', { clientX: 180 });

    const expandLeftHandle = rendered.container.querySelector('[aria-label="Expand left project rail"]') as HTMLButtonElement;
    expect(readWidthVar(shell, '--project-page-left-width')).toBe('0px');
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');
    expect(expandLeftHandle.getAttribute('aria-expanded')).toBe('false');

    dispatchPointer(expandLeftHandle, 'pointerdown', { button: 0, clientX: 220 });
    dispatchPointer(window, 'pointermove', { clientX: 272 });
    dispatchPointer(window, 'pointerup', { clientX: 272 });

    const resizedLeftHandle = rendered.container.querySelector('[aria-label="Resize left project rail"]') as HTMLButtonElement;
    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');
    expect(resizedLeftHandle.getAttribute('aria-expanded')).toBe('true');

    rendered.unmount();
  });

  it('still lets a collapsed rail expand from a click', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const leftHandle = rendered.container.querySelector('[aria-label="Resize left project rail"]') as HTMLButtonElement;

    dispatchPointer(leftHandle, 'pointerdown', { button: 0, clientX: 500 });
    dispatchPointer(window, 'pointermove', { clientX: 180 });
    dispatchPointer(window, 'pointerup', { clientX: 180 });

    const expandLeftHandle = rendered.container.querySelector('[aria-label="Expand left project rail"]') as HTMLButtonElement;
    dispatchPointer(expandLeftHandle, 'click');

    expect(readWidthVar(shell, '--project-page-left-width')).toBe('280px');

    rendered.unmount();
  });

  it('toggles the right rail from the keyboard and restores the resized width on expand', () => {
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const rightHandle = rendered.container.querySelector('[aria-label="Resize right project rail"]') as HTMLButtonElement;

    dispatchPointer(rightHandle, 'pointerdown', { button: 0, clientX: 1000 });
    dispatchPointer(window, 'pointermove', { clientX: 940 });
    dispatchPointer(window, 'pointerup', { clientX: 940 });

    expect(readWidthVar(shell, '--project-page-right-width')).toBe('380px');

    dispatchKeyboard(rightHandle, 'Enter');

    const expandRightHandle = rendered.container.querySelector('[aria-label="Expand right project rail"]') as HTMLButtonElement;
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('0px');
    expect(expandRightHandle.getAttribute('aria-expanded')).toBe('false');

    dispatchKeyboard(expandRightHandle, 'Enter');

    const resizedRightHandle = rendered.container.querySelector('[aria-label="Resize right project rail"]') as HTMLButtonElement;
    expect(readWidthVar(shell, '--project-page-right-width')).toBe('380px');
    expect(resizedRightHandle.getAttribute('aria-expanded')).toBe('true');

    rendered.unmount();
  });

  it('disables resize handles in the stacked mobile layout', () => {
    setProjectPageShellWidth(1200);
    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);

    expect(rendered.container.querySelector('[aria-label="Resize left project rail"]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Resize right project rail"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-rail="left"]')).toBeNull();
    expect(rendered.container.querySelector('[data-project-rail="right"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-details-panel"]')).toBeNull();
    expect(latestShowDetailsTab).toBe(true);

    rendered.unmount();
  });

  it('shows the design configurator in the right rail and keeps details on the left without rewriting stored slots', () => {
    mockActiveTab = 'estimates';
    mockConfiguratorOverride = true;
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: ['details'],
        right: [],
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;
    const leftRail = rendered.container.querySelector('[data-project-rail="left"]') as HTMLElement;
    const rightRail = rendered.container.querySelector('[data-project-rail="right"]') as HTMLElement;

    expect(shell.dataset.projectDesignWorkspace).toBe('true');
    expect(Array.from(leftRail.querySelectorAll('[data-project-panel]')).map((node) => (node as HTMLElement).dataset.projectPanel)).toEqual([
      'details',
    ]);
    expect(rightRail.dataset.projectDesignRailActive).toBe('true');
    expect(rightRail.querySelector('[data-testid="mock-configurator-rail"]')).not.toBeNull();
    expect(rightRail.querySelector('[data-project-panel]')).toBeNull();
    expect(window.localStorage.getItem(PROJECT_PANEL_LAYOUT_STORAGE_KEY)).toBe(JSON.stringify({ left: ['details'], right: [] }));

    rendered.unmount();
  });

  it('auto-expands the right rail when the designs configurator takes over a collapsed rail', () => {
    mockActiveTab = 'estimates';
    mockConfiguratorOverride = true;
    window.localStorage.setItem(
      PROJECT_PAGE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        leftWidthPx: 280,
        rightWidthPx: 320,
        leftCollapsed: false,
        rightCollapsed: true,
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="estimates" />);
    const shell = rendered.container.querySelector('[data-project-page-shell="true"]') as HTMLElement;

    expect(readWidthVar(shell, '--project-page-right-width')).toBe('320px');
    expect(rendered.container.querySelector('[aria-label="Resize right project rail"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="mock-configurator-rail"]')).not.toBeNull();

    rendered.unmount();
  });

  it('restores the normal saved rails when another tab is active', () => {
    mockActiveTab = 'quotes';
    mockConfiguratorOverride = false;
    window.localStorage.setItem(
      PROJECT_PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        left: ['details'],
        right: [],
      }),
    );

    const rendered = renderIntoDocument(<ProjectPageShell snapshot={snapshot as any} tab="quotes" />);
    const leftRail = rendered.container.querySelector('[data-project-rail="left"]') as HTMLElement;
    const rightRail = rendered.container.querySelector('[data-project-rail="right"]') as HTMLElement;

    expect(Array.from(leftRail.querySelectorAll('[data-project-panel]')).map((node) => (node as HTMLElement).dataset.projectPanel)).toEqual([
      'details',
    ]);
    expect(rightRail.querySelectorAll('[data-project-panel]').length).toBe(0);
    expect(rendered.container.querySelector('[data-testid="mock-configurator-rail"]')).toBeNull();

    rendered.unmount();
  });
});
