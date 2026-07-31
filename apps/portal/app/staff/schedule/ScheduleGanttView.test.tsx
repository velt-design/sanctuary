import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { dispatchKeyboard, renderIntoDocument } from '../../../../../test/reactHarness';
import ScheduleGanttView, { type ScheduleGanttViewProps } from './ScheduleGanttView';
import { SCHEDULE_HIDDEN_CREWS_STORAGE_KEY } from './useScheduleCrewVisibility';

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

const secondInstaller: Installer = {
  id: 'crew-beta',
  name: 'Crew Beta',
  color: '#1d4ed8',
  active: true,
  sortOrder: 1,
};

function makeScheduleItem(
  id: string,
  installerId: string,
  overrides: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    ...scheduleItem,
    id,
    projectId: `project-${id}`,
    estimateId: `estimate-${id}`,
    installerId,
    ...overrides,
  };
}

function scheduleBarFor(
  item: ScheduleItem,
  projectName: string,
): ScheduleGanttViewProps['scheduleBars'][number] {
  const endDate = new Date(`${item.forecastEndExclusive ?? '2026-04-09'}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return {
    scheduleItemId: item.id,
    installerId: item.installerId,
    projectId: item.projectId,
    estimateId: item.estimateId,
    projectName,
    status: 'DEPOSIT',
    startDate: item.forecastStart ?? '2026-04-07',
    endDate: endDate.toISOString().slice(0, 10),
    durationHours: item.durationHoursOverride ?? 16,
  };
}

function ganttProps(): ScheduleGanttViewProps {
  return {
    today: '2026-04-07',
    scheduleMode: 'v2',
    installers: [installer],
    laneItems: new Map([[installer.id, [scheduleItem]]]),
    visibleScheduleItems: [scheduleItem],
    projectsById: new Map([[
      scheduleItem.projectId,
      {
        id: scheduleItem.projectId,
        projectName: 'Alpha Pergola',
        name: 'Alpha Pergola',
        customerName: 'Alex Customer',
        siteAddress: '10 Harbour Road',
        status: 'DEPOSIT',
        nextActionDate: null,
        followUpDate: null,
      },
    ]]),
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
    onOpenUnscheduled: vi.fn(),
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  window.localStorage.removeItem('sp.schedule.ganttDensity');
  window.localStorage.removeItem('sp.schedule.ganttLabelWidth');
  window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ScheduleGanttView accessibility and responsive behavior', () => {
  it('defaults to eight-week visual zoom and groups planning controls semantically', () => {
    const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
    const zoom = rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Timeline scale"]');
    const timelineControls = rendered.container.querySelector<HTMLElement>(
      '[role="group"][aria-label="Timeline controls"]',
    );
    const viewOptions = rendered.container.querySelector<HTMLElement>(
      '[role="group"][aria-label="View options"]',
    );

    expect(zoom?.value).toBe('8');
    expect(Array.from(zoom?.options ?? []).map((option) => [option.value, option.textContent])).toEqual([
      ['4', '4 weeks'],
      ['8', '8 weeks'],
      ['12', '12 weeks'],
    ]);
    expect(timelineControls?.contains(zoom ?? null)).toBe(true);
    expect(timelineControls?.textContent).toContain('Today');
    expect(timelineControls?.textContent).toContain('Needs attention');
    expect(viewOptions?.querySelector('select[aria-label="Density"]')).not.toBeNull();
    expect(viewOptions?.textContent).toContain('Show completed jobs');
    expect(rendered.container.querySelector('[data-gantt-current-week="true"]')).not.toBeNull();

    rendered.unmount();
  });

  it('exposes the timeline as a named region and holidays as keyboard-reachable notes', () => {
    const props = ganttProps();
    props.holidays = [{ date: '2026-04-10', name: 'Regional Day', kind: 'holiday' }];

    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const timeline = rendered.container.querySelector<HTMLElement>(
      '[role="region"][aria-label="Gantt timeline"]',
    );
    const holiday = timeline?.querySelector<HTMLElement>(
      '[role="note"][aria-label="Regional Day (10 Apr)"]',
    );

    expect(timeline).not.toBeNull();
    expect(holiday).not.toBeNull();
    expect(holiday?.tabIndex).toBe(0);
    expect(holiday?.title).toBe('Regional Day (10 Apr)');

    rendered.unmount();
  });

  it('reads the shared crew preference and restores a hidden crew without scheduling', async () => {
    const betaItem = makeScheduleItem('schedule-beta', secondInstaller.id);
    const props = ganttProps();
    props.installers = [installer, secondInstaller];
    props.laneItems = new Map([
      [installer.id, [scheduleItem]],
      [secondInstaller.id, [betaItem]],
    ]);
    props.visibleScheduleItems = [scheduleItem, betaItem];
    props.scheduleBars = [
      scheduleBarFor(scheduleItem, 'Alpha Pergola'),
      scheduleBarFor(betaItem, 'Beta Pergola'),
    ];
    window.localStorage.setItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY, JSON.stringify([secondInstaller.id]));

    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    await flushEffects();

    expect(rendered.container.querySelector(`[data-gantt-crew-id="${installer.id}"]`)).not.toBeNull();
    expect(rendered.container.querySelector(`[data-gantt-crew-id="${secondInstaller.id}"]`)).toBeNull();
    expect(rendered.container.querySelector(`[data-gantt-schedule-item-id="${betaItem.id}"]`)).toBeNull();
    expect(
      rendered.container.querySelector<HTMLInputElement>(`input[data-crew-id="${secondInstaller.id}"]`)?.checked,
    ).toBe(false);
    expect(
      rendered.container.querySelector('summary[aria-label^="Filter crews"]')?.getAttribute('aria-label'),
    ).toBe('Filter crews, 1 of 2 visible');

    const showAll = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Show all',
    );
    act(() => showAll?.click());

    expect(rendered.container.querySelector(`[data-gantt-crew-id="${secondInstaller.id}"]`)).not.toBeNull();
    expect(rendered.container.querySelector(`[data-gantt-schedule-item-id="${betaItem.id}"]`)).not.toBeNull();
    expect(window.localStorage.getItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY)).toBeNull();
    expect(props.onMovePin).not.toHaveBeenCalled();
    expect(props.onResizePin).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps a recovery action available when the shared crew preference hides every crew', async () => {
    const betaItem = makeScheduleItem('schedule-beta', secondInstaller.id);
    const props = ganttProps();
    props.installers = [installer, secondInstaller];
    props.laneItems = new Map([
      [installer.id, [scheduleItem]],
      [secondInstaller.id, [betaItem]],
    ]);
    props.visibleScheduleItems = [scheduleItem, betaItem];
    props.scheduleBars = [
      scheduleBarFor(scheduleItem, 'Alpha Pergola'),
      scheduleBarFor(betaItem, 'Beta Pergola'),
    ];
    window.localStorage.setItem(
      SCHEDULE_HIDDEN_CREWS_STORAGE_KEY,
      JSON.stringify([installer.id, secondInstaller.id]),
    );

    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    await flushEffects();

    const emptyState = rendered.container.querySelector<HTMLElement>(
      '[role="status"][aria-label="Gantt empty state"]',
    );
    expect(rendered.container.querySelectorAll('[data-gantt-crew-id]')).toHaveLength(0);
    expect(emptyState?.textContent).toContain('No crews visible');
    expect(emptyState?.textContent).toContain('saved crew filter');

    const recovery = Array.from(emptyState?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Show all crews',
    );
    act(() => recovery?.click());

    expect(rendered.container.querySelectorAll('[data-gantt-crew-id]')).toHaveLength(2);
    expect(rendered.container.querySelector('[role="status"][aria-label="Gantt empty state"]')).toBeNull();
    expect(props.onMovePin).not.toHaveBeenCalled();
    expect(props.onResizePin).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('filters to deduplicated factual attention and recovers from an empty result', () => {
    const attentionItem = makeScheduleItem('schedule-attention', installer.id, {
      clientUpdateStatus: 'needed',
      plannedCommitmentType: 'fixed_date',
      plannedStart: '2026-04-07',
      plannedFlexDays: 1,
      driftDays: 4,
    });
    const cleanItem = makeScheduleItem('schedule-clean', installer.id, {
      sortIndex: 1,
      clientUpdateStatus: 'acknowledged',
      driftDays: 1,
      plannedCommitmentType: 'fixed_date',
      plannedStart: '2026-04-07',
      plannedFlexDays: 2,
    });
    const props = ganttProps();
    props.laneItems = new Map([[installer.id, [attentionItem, cleanItem]]]);
    props.visibleScheduleItems = [attentionItem, cleanItem];
    props.scheduleBars = [
      scheduleBarFor(attentionItem, 'Attention Pergola'),
      scheduleBarFor(cleanItem, 'Clean Pergola'),
    ];
    props.scheduleIssues = [
      { scheduleItemId: attentionItem.id, level: 'warning', message: 'Schedule warning' },
      { scheduleItemId: attentionItem.id, level: 'error', message: 'Pinned conflict' },
    ];

    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const attentionButton = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Needs attention'),
    );

    expect(attentionButton?.getAttribute('aria-pressed')).toBe('false');
    expect(attentionButton?.textContent).toContain('1');
    expect(rendered.container.querySelector(`[data-gantt-schedule-item-id="${attentionItem.id}"]`)).not.toBeNull();
    expect(rendered.container.querySelector(`[data-gantt-schedule-item-id="${cleanItem.id}"]`)).not.toBeNull();

    act(() => attentionButton?.click());

    expect(attentionButton?.getAttribute('aria-pressed')).toBe('true');
    expect(
      rendered.container.querySelector(`[data-gantt-schedule-item-id="${attentionItem.id}"]`)?.getAttribute(
        'data-needs-attention',
      ),
    ).toBe('true');
    expect(rendered.container.querySelector(`[data-gantt-schedule-item-id="${cleanItem.id}"]`)).toBeNull();
    expect(rendered.container.querySelectorAll('[data-gantt-schedule-item-id]')).toHaveLength(1);

    rendered.unmount();

    const cleanProps = ganttProps();
    cleanProps.visibleScheduleItems = [{ ...scheduleItem, clientUpdateStatus: 'acknowledged' }];
    cleanProps.laneItems = new Map([[installer.id, cleanProps.visibleScheduleItems]]);
    const cleanRendered = renderIntoDocument(<ScheduleGanttView {...cleanProps} />);
    const emptyAttentionButton = Array.from(cleanRendered.container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('Needs attention'),
    );
    act(() => emptyAttentionButton?.click());

    const emptyState = cleanRendered.container.querySelector<HTMLElement>(
      '[role="status"][aria-label="Gantt empty state"]',
    );
    expect(emptyState?.textContent).toContain('Nothing needs attention');
    expect(emptyState?.textContent).toContain('drift beyond the allowed flex');

    const showAllJobs = Array.from(emptyState?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (button) => button.textContent?.trim() === 'Show all jobs',
    );
    act(() => showAllJobs?.click());

    expect(cleanRendered.container.querySelector(`[data-gantt-crew-id="${installer.id}"]`)).not.toBeNull();
    expect(cleanRendered.container.querySelector('[role="status"][aria-label="Gantt empty state"]')).toBeNull();
    cleanRendered.unmount();
  });

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
    expect(bar?.getAttribute('aria-label')).toContain('Customer Alex Customer');
    expect(bar?.getAttribute('aria-label')).toContain('Site 10 Harbour Road');
    expect(bar?.getAttribute('aria-label')).toContain('Crew Crew Alpha');

    bar?.focus();
    if (bar) dispatchKeyboard(bar, 'Enter');

    const dialog = rendered.container.querySelector<HTMLElement>('[role="dialog"][aria-label="Gantt quick actions"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Open project');
    expect(dialog?.textContent).toContain('Alex Customer · 10 Harbour Road');
    expect(dialog?.textContent).toContain('Crew: Crew Alpha');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('data-modal-panel')).toBe('true');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(dialog);

    const actionButtons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    expect(actionButtons.length).toBeGreaterThan(1);
    actionButtons[actionButtons.length - 1]?.focus();
    dispatchKeyboard(actionButtons[actionButtons.length - 1], 'Tab');
    expect(document.activeElement).toBe(actionButtons[0]);

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
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(bar);

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
      (button) => button.getAttribute('aria-label') === 'Jump to today',
    );

    act(() => jumpButton?.click());

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    rendered.unmount();
  });

  it('keeps commitment editing visible but removes pin actions for an in-progress locked job', () => {
    const props = ganttProps();
    const lockedItem = { ...scheduleItem, jobStatus: 'in_progress' as const };
    props.visibleScheduleItems = [lockedItem];
    props.laneItems = new Map([[installer.id, [lockedItem]]]);
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    if (bar) dispatchKeyboard(bar, 'Enter');
    const dialog = rendered.container.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Gantt quick actions"]',
    );
    const labels = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).map(
      (button) => button.textContent?.trim(),
    );

    expect(labels).toContain('Lock schedule...');
    expect(labels).not.toContain('Pin...P');
    expect(labels).not.toContain('UnpinP');

    if (dialog) dispatchKeyboard(dialog, 'p');
    expect(props.onOpenPinEdit).not.toHaveBeenCalled();
    expect(props.onUnpinScheduleItem).not.toHaveBeenCalled();
    expect(props.onOpenCommitmentEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it.each([
    {
      label: 'done',
      scheduleMode: 'v2' as const,
      item: { ...scheduleItem, jobStatus: 'done' as const },
    },
    {
      label: 'legacy',
      scheduleMode: 'legacy' as const,
      item: scheduleItem,
    },
  ])('hides V2 schedule-edit actions and makes P a no-op for $label jobs', ({ scheduleMode, item }) => {
    const props = ganttProps();
    props.scheduleMode = scheduleMode;
    props.visibleScheduleItems = [item];
    props.laneItems = new Map([[installer.id, [item]]]);
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    if (bar) dispatchKeyboard(bar, 'Enter');
    const dialog = rendered.container.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Gantt quick actions"]',
    );
    const labels = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).map(
      (button) => button.textContent?.trim(),
    );

    expect(labels).toEqual(['Open projectEnter', 'Open project pack']);
    if (dialog) dispatchKeyboard(dialog, 'p');
    expect(props.onOpenPinEdit).not.toHaveBeenCalled();
    expect(props.onUnpinScheduleItem).not.toHaveBeenCalled();
    expect(props.onOpenCommitmentEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('reviews pointer move and resize timing before forwarding callbacks across the extracted timeline boundary', () => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const itemRow = rendered.container.querySelector<HTMLElement>(
      `[data-gantt-schedule-item-id="${scheduleItem.id}"]`,
    );
    const bar = itemRow?.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    act(() => {
      bar?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 154, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 154, clientY: 100 }));
    });

    expect(props.onMovePin).not.toHaveBeenCalled();
    expect(props.onResizePin).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Review timing change');
    expect(document.body.textContent).toContain('Current07 Apr to 08 Apr · 2d');
    expect(document.body.textContent).toContain('RequestedStart 09 Apr · 2d duration');
    expect(document.body.textContent).not.toContain('Proposed09 Apr to 10 Apr');
    expect(document.body.textContent).toContain('server will calculate the finish against the crew calendar, holidays and closures');
    const applyMove = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Check impact');
    act(() => applyMove?.click());
    expect(props.onMovePin).toHaveBeenCalledWith(scheduleItem.id, '2026-04-09', 2);

    const resizeHandle = itemRow?.querySelector<HTMLElement>('[data-gantt-resize-handle="true"]');
    act(() => {
      resizeHandle?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 154, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 154, clientY: 100 }));
    });

    expect(props.onResizePin).not.toHaveBeenCalled();
    const applyResize = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Check impact');
    act(() => applyResize?.click());
    expect(props.onResizePin).toHaveBeenCalledWith(scheduleItem.id, '2026-04-07', 4);
    rendered.unmount();
  });

  it('disables impact checking when authoritative timing changes during an open review', async () => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');

    act(() => {
      bar?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 154, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 154, clientY: 100 }));
    });

    const changedItem = { ...scheduleItem, updatedAt: '2026-04-01T01:00:00.000Z' };
    rendered.rerender(
      <ScheduleGanttView
        {...props}
        visibleScheduleItems={[changedItem]}
        laneItems={new Map([[installer.id, [changedItem]]])}
      />,
    );
    await flushEffects();

    const checkImpact = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Check impact');
    expect(checkImpact?.disabled).toBe(true);
    expect(document.body.textContent).toContain('The schedule changed while this review was open');
    act(() => checkImpact?.click());
    expect(props.onMovePin).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('uses a read-only crew agenda instead of a compressed timeline at phone width', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 });
    try {
      const props = ganttProps();
      const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
      await flushEffects();

      expect(rendered.container.querySelector('[data-layout-mode="compact"]')).not.toBeNull();
      expect(rendered.container.querySelector('[aria-label="Gantt timeline"]')).toBeNull();
      expect(rendered.container.querySelector('[aria-label="Crew schedule agenda"]')).not.toBeNull();
      expect(rendered.container.textContent).toContain('Read-only here');
      expect(rendered.container.textContent).toContain('Forecast: 07 Apr to 08 Apr');
      expect(rendered.container.textContent).toContain('Stage: Deposit');
      expect(rendered.container.textContent).toContain('Plan: Draft');

      const openProject = rendered.container.querySelector<HTMLButtonElement>('button[aria-label^="Open project Alpha Pergola."]');
      expect(openProject?.getAttribute('aria-label')).toContain('Forecast 07 Apr to 08 Apr, 2d');
      expect(openProject?.getAttribute('aria-label')).toContain('Stage Deposit. Plan Draft. Pinned');
      act(() => openProject?.click());
      expect(props.onOpenProject).toHaveBeenCalledWith(scheduleItem.projectId);

      const boardButton = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
        .find((button) => button.textContent === 'Open Board and unscheduled work');
      act(() => boardButton?.click());
      expect(props.onOpenUnscheduled).toHaveBeenCalledWith(boardButton);
      rendered.unmount();
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptor);
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  });

  it('uses the condensed agenda when zoom leaves too little operating height for the timeline', async () => {
    const widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 720 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
    try {
      const rendered = renderIntoDocument(<ScheduleGanttView {...ganttProps()} />);
      await flushEffects();

      expect(rendered.container.querySelector('[data-layout-mode="compact-short"]')).not.toBeNull();
      expect(rendered.container.querySelector('[aria-label="Gantt timeline"]')).toBeNull();
      expect(rendered.container.querySelector('[aria-label="Crew schedule agenda"]')).not.toBeNull();
      expect(rendered.container.textContent).toContain('Plan 06 Apr to 28 Jun');
      expect(rendered.container.textContent).toContain('Open Board and unscheduled work');
      rendered.unmount();
    } finally {
      if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDescriptor);
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDescriptor);
      else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    }
  });

  it('offers a truthful route from Gantt to unscheduled Board work', () => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const button = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button'))
      .find((candidate) => candidate.textContent === 'View unscheduled jobs');

    act(() => button?.click());

    expect(props.onOpenUnscheduled).toHaveBeenCalledWith(button);
    rendered.unmount();
  });

  it.each([
    {
      label: 'updated timestamp',
      item: { ...scheduleItem, updatedAt: '2026-04-01T01:00:00.000Z' },
      bar: null,
    },
    {
      label: 'forecast dates',
      item: {
        ...scheduleItem,
        forecastStart: '2026-04-08',
        forecastEndExclusive: '2026-04-10',
      },
      bar: {
        ...ganttProps().scheduleBars[0],
        startDate: '2026-04-08',
        endDate: '2026-04-09',
      },
    },
    {
      label: 'job status',
      item: { ...scheduleItem, jobStatus: 'in_progress' as const },
      bar: null,
    },
  ])('cancels an active drag when authoritative $label changes during rerender', async ({ item, bar }) => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const ganttBar = rendered.container.querySelector<HTMLElement>(
      '[role="button"][aria-haspopup="dialog"]',
    );

    act(() => {
      ganttBar?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    });
    expect(
      rendered.container.querySelector('[data-gantt-schedule-item-id] [data-dragging="true"]'),
    ).not.toBeNull();

    rendered.rerender(
      <ScheduleGanttView
        {...props}
        visibleScheduleItems={[item]}
        laneItems={new Map([[installer.id, [item]]])}
        scheduleBars={[bar ?? props.scheduleBars[0]]}
      />,
    );
    await flushEffects();

    expect(
      rendered.container.querySelector('[data-gantt-schedule-item-id] [data-dragging="true"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Timeline scale"]')?.disabled,
    ).toBe(false);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 154, clientY: 100 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 154, clientY: 100 }));
    });

    expect(props.onMovePin).not.toHaveBeenCalled();
    expect(props.onResizePin).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('re-enables view controls when pointer interactions are cancelled', () => {
    const props = ganttProps();
    const rendered = renderIntoDocument(<ScheduleGanttView {...props} />);
    const bar = rendered.container.querySelector<HTMLElement>('[role="button"][aria-haspopup="dialog"]');
    const separator = rendered.container.querySelector<HTMLElement>('[role="separator"]');
    const zoom = rendered.container.querySelector<HTMLSelectElement>('select[aria-label="Timeline scale"]');

    act(() => {
      bar?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    });
    expect(zoom?.disabled).toBe(true);
    act(() => window.dispatchEvent(new Event('pointercancel')));
    expect(zoom?.disabled).toBe(false);
    expect(props.onMovePin).not.toHaveBeenCalled();
    expect(props.onResizePin).not.toHaveBeenCalled();

    act(() => {
      separator?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 260 }));
    });
    expect(zoom?.disabled).toBe(true);
    act(() => window.dispatchEvent(new Event('blur')));
    expect(zoom?.disabled).toBe(false);

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

  it('keeps the legacy Gantt readable without exposing V2 timing controls', () => {
    const props = ganttProps();
    props.scheduleMode = 'legacy';
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
  });

  it('keeps narrow touch targets and reduced-motion transitions in the Gantt stylesheet', () => {
    const css = readFileSync(path.join(process.cwd(), 'apps/portal/app/staff/schedule/scheduleGantt.module.css'), 'utf8');

    expect(css).toContain('@container gantt (max-width: 640px)');
    expect(css).toMatch(/\.ganttControlButton,[\s\S]*min-height:\s*44px;/);
    expect(css).toMatch(/\.ganttCollapseBtn\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.ganttBar,[\s\S]*transition:\s*none;/);
  });
});
