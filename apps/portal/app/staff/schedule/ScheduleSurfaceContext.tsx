'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type ScheduleCrewFilter from './ScheduleCrewFilterSurface';
import type ScheduleGanttToolbar from './ScheduleGanttToolbar';
import type ScheduleGanttCompactSurface from './ScheduleGanttCompactSurface';
import type { GanttCalendar } from './ScheduleGanttCalendarModel';
import { useScheduleGanttViewport } from './useScheduleGanttViewport';

export type BoardSurfaceEvidence = {
  unscheduledCount: number | null;
  visibleCrewCount: number | null;
  crewFilter: ComponentProps<typeof ScheduleCrewFilter>;
};
export type GanttSurfaceEvidence = {
  calendar: GanttCalendar;
  toolbar: ComponentProps<typeof ScheduleGanttToolbar>;
  compact: Omit<ComponentProps<typeof ScheduleGanttCompactSurface>, 'children'>;
  snapGuidePx: number | null;
  overlays: ReactNode;
};
type SlotName = 'unscheduled' | 'lanes' | 'debug' | 'live' | 'boardOverlay'
  | 'timelineRows' | 'timelineEmpty' | 'compactRows';
type Slots = Record<SlotName, HTMLDivElement | null>;
const emptySlots: Slots = { unscheduled: null, lanes: null, debug: null, live: null,
  boardOverlay: null, timelineRows: null, timelineEmpty: null, compactRows: null };
type Viewport = ReturnType<typeof useScheduleGanttViewport>;
type SurfaceController = {
  slots: Slots;
  slotRefs: Record<SlotName, (node: HTMLDivElement | null) => void>;
  gantt: Viewport;
  publishBoard: (value: BoardSurfaceEvidence | null) => void;
  publishGantt: (value: GanttSurfaceEvidence | null) => void;
};
const ControllerContext = createContext<SurfaceController | null>(null);
const EvidenceContext = createContext<{ board: BoardSurfaceEvidence | null; gantt: GanttSurfaceEvidence | null }>({ board: null, gantt: null });

function SurfaceEvidenceOwner({ owner, gantt, children }: { owner: object | null; gantt: Viewport; children: ReactNode }) {
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [slots, setSlots] = useState(emptySlots);
  const [board, setBoard] = useState<{ owner: object | null; value: BoardSurfaceEvidence | null } | null>(null);
  const [timeline, setTimeline] = useState<{ owner: object | null; value: GanttSurfaceEvidence | null } | null>(null);
  const publishBoard = useCallback((value: BoardSurfaceEvidence | null) => {
    if (owner !== currentOwner.current) return;
    setBoard(current => value === null && current?.owner !== owner ? current : { owner, value });
  }, [owner]);
  const publishGantt = useCallback((value: GanttSurfaceEvidence | null) => {
    if (owner !== currentOwner.current) return;
    setTimeline(current => value === null && current?.owner !== owner ? current : { owner, value });
  }, [owner]);
  const slotRefs = useMemo(() => Object.fromEntries(Object.keys(emptySlots).map(key => [key,
    (node: HTMLDivElement | null) => setSlots(current => current[key as SlotName] === node ? current : { ...current, [key]: node }),
  ])) as SurfaceController['slotRefs'], []);
  const controller = useMemo(() => ({ slots, slotRefs, gantt, publishBoard, publishGantt }),
    [slots, slotRefs, gantt, publishBoard, publishGantt]);
  return <ControllerContext.Provider value={controller}>
    <EvidenceContext.Provider value={{ board: owner && board?.owner === owner ? board.value : null,
      gantt: owner && timeline?.owner === owner ? timeline.value : null }}>{children}</EvidenceContext.Provider>
  </ControllerContext.Provider>;
}

/** This provider owns public viewport state, not queries, caches or commands. */
export function ScheduleSurfaceProvider({ owner, today, ganttActive, children }: {
  owner: object | null; today: string; ganttActive: boolean; children: ReactNode;
}) {
  const gantt = useScheduleGanttViewport(today, ganttActive);
  return <SurfaceEvidenceOwner owner={owner} gantt={gantt}>{children}</SurfaceEvidenceOwner>;
}
export function useScheduleSurfaceController() { return useContext(ControllerContext); }
export function useScheduleSurfaceEvidence() { return useContext(EvidenceContext); }
export function ScheduleSurfaceIsolation({ children }: { children: ReactNode }) {
  return <ControllerContext.Provider value={null}>{children}</ControllerContext.Provider>;
}
