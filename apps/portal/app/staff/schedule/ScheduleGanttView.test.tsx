import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { dispatchKeyboard, renderIntoDocument } from '../../../../../test/reactHarness';
import ScheduleGanttView, { type ScheduleGanttViewProps } from './ScheduleGanttView';

const installer: Installer = {
  id: 'crew-alpha',
  name: 'Crew Alpha',
  color: '#0f766e',
  active: true,
  sortOrder: 0,
};

const scheduleItem: ScheduleItem = {
  id: 'schedule-alpha',
  projectId: 'project-alpha',
  estimateId: 'estimate-alpha',
  installerId: installer.id,
  sortIndex: 0,
  itemType: 'job',
  forecastStart: '2026-04-07',
  forecastEndExclusive: '2026-04-09',
  forecastDurationDays: 2,
  durationHoursOverride: 18,
  mode: 'pinned',
  jobStatus: 'not_started',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

function ganttProps(): ScheduleGanttViewProps {
  return {
    today: '2026-04-07',
    scheduleMode: 'v2',
    installers: [installer],
    laneItems: new Map([[installer.id, [scheduleItem]]]),
    visibleScheduleItems: [scheduleItem],
    projectsById: new Map(),
    estimatesById: new Map(),
    scheduleBars: [
      {
        scheduleItemId: scheduleItem.id,
        installerId: installer.id,
        projectId: scheduleItem.projectId,
        estimateId: scheduleItem.estimateId,
        projectName: 'Alpha Pergola',
        status: 'DEPOSIT',
        startDate: '2026-04-07',
        endDate: '2026-04-08',
        durationHours: 18,
      },
    ],
    scheduleIssues: [],
    holidays: [],
    showCompleted: false,
    onShowCompletedChange: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenProjectPack: vi.fn(),
    onOpenCommitmentEdit: vi.fn(),
    onOpenPinEdit: vi.fn(),
    onUnpinScheduleItem: vi.fn(),
    onAckClientUpdate: vi.fn(),
    onMovePin: vi.fn(),
    onResizePin: vi.fn(),
  };
}

afterEach(() => {
  window.localStorage.removeItem('sp.schedule.ganttDensity');
  window.localStorage.removeItem('sp.schedule.ganttLabelWidth');
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ScheduleGanttView accessibility and responsive behavior', () => {
  it('shows planned and forecast timing together by default', () => {
    const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
    const plannedToggle = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Hide planned',
    );

    expect(plannedToggle).toBeTruthy();
    expect(plannedToggle?.getAttribute('aria-pressed')).toBe('true');
    expect(rendered.container.textContent).toContain('Planned');

    rendered.unmount();
  });

  it('makes job bars keyboard focusable and opens their action dialog with Enter', async () => {
    const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    expect(bar).not.toBeNull();
    expect(bar?.tabIndex).toBe(0);
    expect(bar?.getAttribute('aria-label')).toContain('Alpha Pergola');

    bar?.focus();
    if (bar) dispatchKeyboard(bar, 'Enter');

    const dialog = rendered.container.querySelector<HTMLElement>('[role="dialog"][aria-label="Gantt quick actions"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Open project');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(dialog);

    if (dialog) dispatchKeyboard(dialog, 'Escape');
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(bar);

    rendered.unmount();
  });

  it('does not hijack Enter from a focused quick-action button', async () => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    if (bar) dispatchKeyboard(bar, 'Enter');
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    const pinButton = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
      (button) => button.textContent?.includes('Unpin'),
    );
    expect(pinButton).toBeTruthy();

    pinButton?.focus();
    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    });
    act(() => {
      pinButton?.dispatchEvent(enterEvent);
    });

    expect(enterEvent.defaultPrevented).toBe(false);
    expect(props.onOpenProject).not.toHaveBeenCalled();

    act(() => {
      pinButton?.click();
    });
    expect(props.onUnpinScheduleItem).toHaveBeenCalledWith(scheduleItem.id);

    rendered.unmount();
  });

  it('exposes and updates crew-label width through the keyboard separator contract', () => {
    const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
    const separator = rendered.container.querySelector<HTMLElement>('[role="separator"]');

    expect(separator).not.toBeNull();
    expect(separator?.tabIndex).toBe(0);
    expect(separator?.getAttribute('aria-valuemin')).toBe('220');
    expect(separator?.getAttribute('aria-valuemax')).toBe('420');
    expect(separator?.getAttribute('aria-valuenow')).toBe('260');

    if (separator) dispatchKeyboard(separator, 'ArrowRight');
    expect(separator?.getAttribute('aria-valuenow')).toBe('270');
    expect(separator?.getAttribute('aria-valuetext')).toBe('270 pixels');
    expect(window.localStorage.getItem('sp.schedule.ganttLabelWidth')).toBe('270');

    if (separator) dispatchKeyboard(separator, 'Home');
    expect(separator?.getAttribute('aria-valuenow')).toBe('220');

    rendered.unmount();
  });

  it('shrinks the crew-label column only when needed to preserve useful narrow timeline width', () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    let viewportWidth = 327;
    window.localStorage.setItem('sp.schedule.ganttLabelWidth', '320');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute('aria-label') === 'Gantt timeline' ? viewportWidth : 0;
      },
    });

    try {
      const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
      const separator = rendered.container.querySelector<HTMLElement>('[role="separator"]');
      const labelWidth = Number(separator?.getAttribute('aria-valuenow'));

      expect(separator?.getAttribute('aria-valuemin')).toBe('120');
      expect(separator?.getAttribute('aria-valuemax')).toBe('167');
      expect(labelWidth).toBe(167);
      expect(327 - labelWidth).toBeGreaterThanOrEqual(160);

      viewportWidth = 800;
      act(() => window.dispatchEvent(new Event('resize')));
      expect(separator?.getAttribute('aria-valuenow')).toBe('320');

      rendered.unmount();
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  it('uses instant scrolling when reduced motion is requested', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
    const scroller = rendered.container.querySelector<HTMLElement>('[aria-label="Gantt timeline"]');
    const scrollTo = vi.fn();
    Object.defineProperty(scroller, 'scrollTo', { configurable: true, value: scrollTo });
    const jumpButton = Array.from(rendered.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Jump to today',
    );

    act(() => jumpButton?.click());

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    rendered.unmount();
  });

  it.each(['in_progress', 'paused', 'done'] as const)(
    'keeps %s jobs readable but prevents Gantt move and resize commands',
    (jobStatus) => {
      const props = ganttProps();
      const lockedItem = { ...scheduleItem, jobStatus };
      props.visibleScheduleItems = [lockedItem];
      props.laneItems = new Map([[installer.id, [lockedItem]]]);
      const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
      const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

      expect(bar).not.toBeNull();
      expect(bar?.getAttribute('data-timing-adjustable')).toBe('false');
      expect(rendered.container.querySelector('[data-gantt-resize-handle="true"]')).toBeNull();

      act(() => {
        bar?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
        window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 180 }));
        window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 180 }));
      });

      expect(props.onMovePin).not.toHaveBeenCalled();
      expect(props.onResizePin).not.toHaveBeenCalled();
      rendered.unmount();
    },
  );

  it('keeps narrow touch targets and reduced-motion transitions in the Gantt stylesheet', () => {
    const css = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/scheduleGantt.module.css'), 'utf8');

    expect(css).toContain('@container gantt (max-width: 640px)');
    expect(css).toMatch(/\.ganttControlButton,[\s\S]*min-height:\s*44px;/);
    expect(css).toMatch(/\.ganttCollapseBtn\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.ganttBar,[\s\S]*transition:\s*none;/);
  });
});
