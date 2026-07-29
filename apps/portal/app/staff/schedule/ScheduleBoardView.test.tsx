import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleItem } from '@/lib/types/scheduling';
import ScheduleBoardView, { type ScheduleBoardViewProps } from './ScheduleBoardView';
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

describe('ScheduleBoardView', () => {
  beforeEach(() => {
    routerPush.mockClear();
    dndMocks.dragHandleKeyDown.mockClear();
    dndMocks.dragHandlePointerDown.mockClear();
    dndMocks.setActivatorNodeRef.mockClear();
    window.localStorage.removeItem('sp_schedule_debug');
  });

  afterEach(() => {
    window.localStorage.removeItem('sp_schedule_debug');
    vi.restoreAllMocks();
  });

  it('owns the board dnd context and reports semantic lane drops', () => {
    const onDrop = vi.fn();
    const rendered = renderIntoDocument(<ScheduleBoardView {...baseProps({ onDrop })} />);

    expect(rendered.container.textContent).toContain('Unscheduled');
    expect(rendered.container.textContent).toContain('Alpha Deck');
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
    expect(card?.querySelector('button[aria-label="Job actions"]')).not.toBeNull();
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
