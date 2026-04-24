import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScheduleBoardView, { type ScheduleBoardViewProps } from './ScheduleBoardView';
import { renderIntoDocument } from '../../../../../../test/reactHarness';

const routerPush = vi.fn();
const dndMocks = vi.hoisted(() => ({
  latestContextProps: null as any,
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
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
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
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
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
