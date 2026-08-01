import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleItem } from '@/lib/types/scheduling';
import ScheduleBoardView, { type ScheduleBoardViewProps } from './ScheduleBoardView';
import { SCHEDULE_HIDDEN_CREWS_STORAGE_KEY } from './useScheduleCrewVisibility';
import { renderIntoDocument } from '../../../../../test/reactHarness';

const routerPush = vi.fn();
const dndMocks = vi.hoisted(() => ({
  latestContextProps: null as any,
  dragHandleKeyDown: vi.fn(),
  dragHandlePointerDown: vi.fn(),
  setActivatorNodeRef: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@dnd-kit/core', () => ({
  closestCenter: vi.fn(() => []),
  DndContext: (props: any) => {
    dndMocks.latestContextProps = props;
    return props.children;
  },
  DragOverlay: (props: any) => props.children,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  pointerWithin: vi.fn(() => []),
  useDraggable: () => ({
    attributes: { role: 'button', 'aria-roledescription': 'draggable' },
    listeners: {
      onKeyDown: dndMocks.dragHandleKeyDown,
      onPointerDown: dndMocks.dragHandlePointerDown,
    },
    setNodeRef: vi.fn(),
    setActivatorNodeRef: dndMocks.setActivatorNodeRef,
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: (props: any) => props.children,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: { role: 'button', 'aria-roledescription': 'sortable' },
    listeners: {
      onKeyDown: dndMocks.dragHandleKeyDown,
      onPointerDown: dndMocks.dragHandlePointerDown,
    },
    setNodeRef: vi.fn(),
    setActivatorNodeRef: dndMocks.setActivatorNodeRef,
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

function baseProps(overrides: Partial<ScheduleBoardViewProps> = {}): ScheduleBoardViewProps {
  return {
    today: '2026-04-07',
    scheduleMode: 'v2',
    installers: [
      {
        id: 'crew_alpha',
        name: 'Crew Alpha',
        color: '#0f766e',
        active: true,
        sortOrder: 0,
        calendarRegion: 'Auckland',
        baseAvailableDate: '2026-04-08',
      },
    ],
    schedulable: {
      jobsById: new Map([
        [
          'job_alpha',
          {
            id: 'job_alpha',
            projectId: 'proj_alpha',
            estimateId: 'est_alpha',
            projectName: 'Alpha Deck',
            customerName: 'Alex Customer',
            siteAddress: '10 Harbour Road',
            identityDetail: 'Alex Customer · 10 Harbour Road',
            descriptor: '',
            status: 'DEPOSIT',
            durationHours: 16,
            durationLabel: '2d',
            durationTitle: '16h',
            warnings: [],
          },
        ],
      ]),
      unscheduledJobs: [],
      debug: {
        totalProjects: 1,
        schedulableProjects: 1,
        unscheduledJobs: 1,
        excluded: {
          noEstimates: 0,
          noSchedulableEstimate: 0,
          alreadyScheduled: 0,
        },
        scheduleItems: {
          total: 0,
          blocking: 0,
          missingProject: 0,
          missingEstimate: 0,
          estimateNotSchedulable: 0,
        },
      },
      blockingProjectIds: new Set(),
    },
    unscheduledJobs: [
      {
        id: 'job_alpha',
        projectId: 'proj_alpha',
        estimateId: 'est_alpha',
        projectName: 'Alpha Deck',
        customerName: 'Alex Customer',
        siteAddress: '10 Harbour Road',
        identityDetail: 'Alex Customer · 10 Harbour Road',
        descriptor: '',
        status: 'DEPOSIT',
        durationHours: 16,
        durationLabel: '2d',
        durationTitle: '16h',
        warnings: [],
      },
    ],
    unscheduledJobsAll: [],
    laneItems: new Map([['crew_alpha', []]]),
    scheduleItemById: new Map(),
    barsByScheduleId: new Map(),
    issueLevelByScheduleId: new Map(),
    nextAvailableByInstallerId: new Map(),
    unscheduledCollapsed: false,
    query: '',
    showCompleted: false,
    onQueryChange: vi.fn(),
    onToggleUnscheduledCollapsed: vi.fn(),
    onShowCompletedChange: vi.fn(),
    onDrop: vi.fn(),
    buildJobMenuActions: vi.fn(() => []),
    buildDowntimeMenuActions: vi.fn(() => []),
    ...overrides,
  };
}

function crew(index: number): ScheduleBoardViewProps['installers'][number] {
  return {
    id: `crew_${index}`,
    name: `Crew ${index}`,
    color: index % 2 === 0 ? '#0f766e' : '#1d4ed8',
    active: true,
    sortOrder: index,
    calendarRegion: 'Auckland',
    baseAvailableDate: '2026-04-08',
  };
}

function findCrewCheckbox(container: HTMLElement, crewName: string): HTMLInputElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLLabelElement>('label')).find((label) =>
      label.textContent?.includes(crewName),
    )?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
  );
}

async function flushBoardEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ScheduleBoardView', () => {
  beforeEach(() => {
    routerPush.mockClear();
    dndMocks.dragHandleKeyDown.mockClear();
    dndMocks.dragHandlePointerDown.mockClear();
    dndMocks.setActivatorNodeRef.mockClear();
    window.localStorage.removeItem('sp_schedule_debug');
    window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem('sp_schedule_debug');
    window.localStorage.removeItem(SCHEDULE_HIDDEN_CREWS_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it('owns the board dnd context and reports semantic lane drops', () => {
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps({ onDrop })} />);

    expect(rendered.container.textContent).toContain('Unscheduled');
    expect(rendered.container.textContent).toContain('Alpha Deck');
    expect(rendered.container.textContent).toContain('Alex Customer · 10 Harbour Road');
    expect(dndMocks.latestContextProps).toBeTruthy();

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
      dndMocks.latestContextProps.onDragEnd({
        active: { id: 'job_alpha', rect: { current: {} } },
        over: { id: 'lane:crew_alpha' },
      });
    });

    expect(onDrop).toHaveBeenCalledWith(
      'job_alpha',
      expect.objectContaining({
        kind: 'lane',
        laneId: 'crew_alpha',
        insertionIndex: 0,
        placement: 'end',
        overId: 'lane:crew_alpha',
      }),
    );

    rendered.unmount();
  });

  it('gives project opening and keyboard or pointer dragging separate controls', () => {
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps()} />);
    const card = rendered.container.querySelector<HTMLElement>('[data-schedule-card-id="job_alpha"]');
    const openButton = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Open project Alpha Deck"]');
    const moveButton = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Move Alpha Deck"]');

    expect(card).not.toBeNull();
    expect(card?.tagName).toBe('DIV');
    expect(card?.hasAttribute('role')).toBe(false);
    expect(card?.hasAttribute('tabindex')).toBe(false);
    expect(openButton).not.toBeNull();
    expect(moveButton).not.toBeNull();
    expect(card?.querySelector('[role="button"] button')).toBeNull();
    expect(dndMocks.setActivatorNodeRef).toHaveBeenCalledWith(moveButton);

    act(() => {
      openButton?.click();
    });
    expect(routerPush).toHaveBeenCalledWith('/staff/projects/proj_alpha');

    routerPush.mockClear();
    act(() => {
      moveButton?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      moveButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

    expect(dndMocks.dragHandleKeyDown).toHaveBeenCalledTimes(1);
    expect(dndMocks.dragHandlePointerDown).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps scheduled-card project, move, and action controls as siblings', () => {
    const scheduleItem: ScheduleItem = {
      id: 'job_alpha',
      projectId: 'proj_alpha',
      estimateId: 'est_alpha',
      installerId: 'crew_alpha',
      sortIndex: 0,
      scheduleStatus: 'TENTATIVE',
      locked: false,
      itemType: 'job',
      forecastStart: '2026-04-08',
      forecastEndExclusive: '2026-04-10',
      forecastDurationDays: 2,
      mode: 'floating',
      updatedAt: '2026-04-07T00:00:00.000Z',
    };
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          unscheduledJobs: [],
          laneItems: new Map([['crew_alpha', [scheduleItem]]]),
          scheduleItemById: new Map([['job_alpha', scheduleItem]]),
          barsByScheduleId: new Map([['job_alpha', { startDate: '2026-04-08', endDate: '2026-04-09' }]]),
          buildJobMenuActions: vi.fn(() => [{ label: 'Unschedule', onClick: vi.fn() }]),
        })}
      />,
    );
    const card = rendered.container.querySelector<HTMLElement>('[data-schedule-card-id="job_alpha"]');

    expect(card?.hasAttribute('role')).toBe(false);
    expect(card?.querySelector('button[aria-label="Open project Alpha Deck"]')).not.toBeNull();
    expect(card?.querySelector('button[aria-label="Move Alpha Deck"]')).not.toBeNull();
    expect(card?.querySelector('button[aria-label="Job actions for Alpha Deck"]')).not.toBeNull();
    expect(card?.textContent).toContain('Stage: Deposit');
    expect(card?.textContent).toContain('Job: Tentative');
    expect(card?.textContent).toContain('Plan: Draft');
    expect(rendered.container.textContent).toContain('1 job · 2d forecast');
    expect(card?.querySelector('button button')).toBeNull();

    rendered.unmount();
  });

  it('exposes the compact collapsed state while keeping installer lanes available', () => {
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps({ unscheduledCollapsed: true })} />);
    const panel = rendered.container.querySelector<HTMLElement>('aside[aria-label="Unscheduled jobs"]');
    const toggle = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Expand unscheduled panel"]');

    expect(panel?.getAttribute('data-collapsed')).toBe('true');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(rendered.container.querySelector('section[aria-label="Installer lanes"]')).not.toBeNull();
    expect(rendered.container.querySelector('section[aria-label="Lane Crew Alpha"]')).not.toBeNull();

    rendered.unmount();
  });

  it('renders nine active crews and can hide and restore an empty crew without scheduling', async () => {
    const installers = Array.from({ length: 9 }, (_, index) => crew(index + 1));
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          installers,
          laneItems: new Map(installers.map((installer) => [installer.id, []])),
          onDrop,
        })}
      />,
    );
    await flushBoardEffects();

    expect(rendered.container.querySelectorAll('[data-board-lane-id]')).toHaveLength(9);
    expect(rendered.container.querySelector('[data-board-lanes]')?.getAttribute('data-visible-crew-count')).toBe('9');
    expect(rendered.container.querySelector('summary')?.getAttribute('aria-label')).toBe('Filter crews, 9 of 9 visible');

    const crewNineCheckbox = findCrewCheckbox(rendered.container, 'Crew 9');
    expect(crewNineCheckbox?.checked).toBe(true);
    act(() => {
      crewNineCheckbox?.click();
    });

    expect(rendered.container.querySelector('[data-board-lane-id="crew_9"]')).toBeNull();
    expect(rendered.container.querySelector('[data-board-lanes]')?.getAttribute('data-visible-crew-count')).toBe('8');
    expect(onDrop).not.toHaveBeenCalled();

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
    });
    act(() => {
      dndMocks.latestContextProps.onDragEnd({
        active: { id: 'job_alpha', rect: { current: {} } },
        over: { id: 'lane:crew_9' },
      });
    });
    expect(onDrop).not.toHaveBeenCalled();

    const showAll = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Show all',
    );
    act(() => {
      showAll?.click();
    });

    expect(rendered.container.querySelector('[data-board-lane-id="crew_9"]')).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-board-lane-id]')).toHaveLength(9);
    expect(onDrop).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('reports schedule items hidden when a crew with scheduled work is filtered out', async () => {
    const installers = [crew(1), crew(2)];
    const scheduledJobs: ScheduleItem[] = [
      {
        id: 'job_hidden_one',
        projectId: 'project_hidden_one',
        estimateId: 'estimate_hidden_one',
        installerId: 'crew_2',
        sortIndex: 0,
        scheduleStatus: 'TENTATIVE',
        locked: false,
        itemType: 'job',
        forecastStart: '2026-04-08',
        forecastEndExclusive: '2026-04-10',
        forecastDurationDays: 2,
        mode: 'floating',
        updatedAt: '2026-04-07T00:00:00.000Z',
      },
      {
        id: 'job_hidden_two',
        projectId: 'project_hidden_two',
        estimateId: 'estimate_hidden_two',
        installerId: 'crew_2',
        sortIndex: 1,
        scheduleStatus: 'TENTATIVE',
        locked: false,
        itemType: 'job',
        forecastStart: '2026-04-10',
        forecastEndExclusive: '2026-04-11',
        forecastDurationDays: 1,
        mode: 'floating',
        updatedAt: '2026-04-07T00:00:00.000Z',
      },
    ];
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          installers,
          unscheduledJobs: [],
          laneItems: new Map([
            ['crew_1', []],
            ['crew_2', scheduledJobs],
          ]),
          scheduleItemById: new Map(scheduledJobs.map((item) => [item.id, item])),
        })}
      />,
    );
    await flushBoardEffects();

    act(() => {
      findCrewCheckbox(rendered.container, 'Crew 2')?.click();
    });

    expect(rendered.container.querySelector('[data-board-lane-id="crew_2"]')).toBeNull();
    expect(rendered.container.querySelector('summary')?.textContent).toContain('2 items hidden');
    expect(rendered.container.textContent).toContain('1 crew hidden');
    expect(rendered.container.textContent).toContain('2 items hidden');
    expect(rendered.container.querySelector('aside[aria-label="Unscheduled jobs"]')?.textContent).not.toContain('Untitled project');
    rendered.unmount();
  });

  it('keeps a recovery action available when every crew is hidden', async () => {
    const installers = [crew(1), crew(2)];
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          installers,
          laneItems: new Map(installers.map((installer) => [installer.id, []])),
          onDrop,
        })}
      />,
    );
    await flushBoardEffects();

    act(() => {
      findCrewCheckbox(rendered.container, 'Crew 1')?.click();
      findCrewCheckbox(rendered.container, 'Crew 2')?.click();
    });

    expect(rendered.container.querySelectorAll('[data-board-lane-id]')).toHaveLength(0);
    expect(rendered.container.textContent).toContain('All crews are hidden');
    const recovery = Array.from(rendered.container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Show all crews',
    );
    expect(recovery).toBeTruthy();

    act(() => {
      recovery?.click();
    });

    expect(rendered.container.querySelectorAll('[data-board-lane-id]')).toHaveLength(2);
    expect(rendered.container.textContent).not.toContain('All crews are hidden');
    expect(onDrop).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('auto-scrolls the wrapped lane grid toward an offscreen row during drag', () => {
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps()} />);
    const lanes = rendered.container.querySelector<HTMLElement>('[data-board-lanes]');
    expect(lanes).not.toBeNull();
    if (!lanes) return;

    Object.defineProperties(lanes, {
      clientHeight: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 900 },
      scrollWidth: { configurable: true, value: 600 },
    });
    lanes.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 300,
        width: 600,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
    });
    act(() => {
      dndMocks.latestContextProps.onDragMove({
        active: {
          id: 'job_alpha',
          rect: { current: { initial: { left: 100, top: 270, width: 40, height: 40 } } },
        },
        over: null,
      });
    });

    expect(lanes.scrollTop).toBeGreaterThan(0);
    expect(lanes.scrollTop).toBeLessThanOrEqual(24);
    rendered.unmount();
  });

  it('commits the last destination shown to staff even if drag-end collision data changes', () => {
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps({ onDrop })} />);
    const shownTarget = {
      active: {
        id: 'job_alpha',
        rect: { current: { initial: { left: 100, top: 100, width: 40, height: 40 } } },
      },
      over: { id: 'lane:crew_alpha' },
    };

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
      dndMocks.latestContextProps.onDragOver(shownTarget);
    });
    expect(rendered.container.textContent).toContain('Drop at the end of Crew Alpha · position 1.');

    act(() => {
      dndMocks.latestContextProps.onDragEnd({
        active: shownTarget.active,
        over: null,
      });
    });

    expect(onDrop).toHaveBeenCalledWith(
      'job_alpha',
      expect.objectContaining({ kind: 'lane', laneId: 'crew_alpha', insertionIndex: 0 }),
    );
    rendered.unmount();
  });

  it('blocks move gestures while schedule truth is saving', () => {
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          interaction: { disabled: true, reason: 'Another schedule change is still saving.' },
          onDrop,
        })}
      />,
    );

    const move = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Move Alpha Deck unavailable"]');
    expect(move?.disabled).toBe(true);
    expect(move?.title).toBe('Another schedule change is still saving.');
    expect(rendered.container.textContent).not.toContain('Another schedule change is still saving.');

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
      dndMocks.latestContextProps.onDragEnd({ active: { id: 'job_alpha', rect: { current: {} } }, over: { id: 'lane:crew_alpha' } });
    });
    expect(onDrop).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('shows only an actionable card-level notice after a failed move', () => {
    const onAction = vi.fn();
    const rendered = renderIntoDocument(
      <ScheduleBoardView
        {...baseProps({
          mutationNotice: {
            id: 1,
            projectId: 'proj_alpha',
            tone: 'error',
            message: 'Move wasn\'t saved. Previous position restored.',
            actionLabel: 'Retry',
            onAction,
          },
        })}
      />,
    );

    const card = rendered.container.querySelector('[data-schedule-card-id="job_alpha"]');
    expect(card?.getAttribute('data-mutation-notice')).toBe('error');
    expect(card?.textContent).toContain('Previous position restored');
    const retry = Array.from(card?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((button) => button.textContent === 'Retry');
    act(() => retry?.click());
    expect(onAction).toHaveBeenCalledOnce();
    rendered.unmount();
  });

  it('emits dev-only drop diagnostics when the resolved target changes and on drop end', () => {
    window.localStorage.setItem('sp_schedule_debug', '1');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps({ onDrop })} />);
    const dragEvent = {
      active: {
        id: 'job_alpha',
        rect: { current: { initial: { left: 10, top: 20, width: 100, height: 40 } } },
      },
      over: { id: 'lane:crew_alpha' },
    };

    act(() => {
      dndMocks.latestContextProps.onDragStart({ active: { id: 'job_alpha' } });
      dndMocks.latestContextProps.onDragOver(dragEvent);
      dndMocks.latestContextProps.onDragMove(dragEvent);
      dndMocks.latestContextProps.onDragEnd(dragEvent);
    });

    const debugPayloads = debugSpy.mock.calls
      .filter((call) => call[0] === '[schedule]')
      .map((call) => call[1] as { event?: string; [key: string]: unknown });

    expect(debugPayloads.filter((payload) => payload.event === 'board.drop.target')).toHaveLength(1);
    expect(debugPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'board.drop.target',
          activeId: 'job_alpha',
          rawOverId: 'lane:crew_alpha',
          resolvedLaneId: 'crew_alpha',
          insertionIndex: 0,
          placement: 'end',
        }),
        expect.objectContaining({
          event: 'board.drop.end',
          activeId: 'job_alpha',
          rawOverId: 'lane:crew_alpha',
          resolvedLaneId: 'crew_alpha',
          insertionIndex: 0,
          valid: true,
        }),
      ]),
    );
    expect(onDrop).toHaveBeenCalledWith(
      'job_alpha',
      expect.objectContaining({
        debug: expect.objectContaining({
          activeId: 'job_alpha',
          rawOverId: 'lane:crew_alpha',
          resolvedLaneId: 'crew_alpha',
          insertionIndex: 0,
        }),
      }),
    );

    rendered.unmount();
  });
});
