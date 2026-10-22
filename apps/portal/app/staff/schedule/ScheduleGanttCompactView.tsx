'use client';
import ScheduleCrewFilterPanel from './ScheduleCrewFilterPanel';
import { createPortal } from 'react-dom';
import type { ScheduleCrewFilterOption } from './ScheduleCrewFilter';
import type { GanttRow } from './ScheduleGanttModel';
import type { GanttAttentionMode } from './ScheduleGanttToolbar';
import ScheduleGanttCompactSurface from './ScheduleGanttCompactSurface';
import { ScheduleGanttCompactRows } from './ScheduleGanttCompactRows';
import { useScheduleSurfaceController } from './ScheduleSurfaceContext';
export default function ScheduleGanttCompactView({
  today,
  rangeStart,
  rangeEnd,
  rows,
  attentionMode,
  attentionCount,
  readState,
  controlsDisabled,
  crews,
  hiddenCrewIds,
  hiddenItemCount,
  emptyCrewIds, crewPanel,
  showCompleted,
  emptyState,
  onAttentionModeChange,
  onShowCompletedChange,
  onOpenBoard,
  onOpenProject,
  onToggleCrew,
  onHideCrews,
  onShowAllCrews,
  onToggleCrewCollapsed,
}: {
  today: string;
  rangeStart: string;
  rangeEnd: string;
  rows: readonly GanttRow[];
  attentionMode: GanttAttentionMode;
  attentionCount: number | null;
  readState?: 'pending' | 'unavailable';
  controlsDisabled: boolean;
  crewPanel?: import('react').ReactNode;
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  showCompleted: boolean;
  emptyState: { title: string; message: string; actionLabel?: string; onAction?: () => void } | null;
  onAttentionModeChange: (next: GanttAttentionMode) => void;
  onShowCompletedChange: (next: boolean) => void;
  onOpenBoard: (control: HTMLButtonElement) => void;
  onOpenProject: (projectId: string) => void;
  onToggleCrew: (crewId: string) => void;
  onHideCrews: (crewIds: readonly string[]) => void;
  onShowAllCrews: () => void;
  onToggleCrewCollapsed: (installerId: string) => void;
}) {
  const surface = useScheduleSurfaceController();
  const content = <ScheduleGanttCompactRows rows={rows} emptyState={emptyState} onOpenProject={onOpenProject} onToggleCrewCollapsed={onToggleCrewCollapsed} />;
  if (surface) return surface.slots.compactRows ? createPortal(content, surface.slots.compactRows) : null;
  return <ScheduleGanttCompactSurface crewPanel={crewPanel??<ScheduleCrewFilterPanel crews={crews} hiddenCrewIds={hiddenCrewIds} hiddenItemCount={hiddenItemCount} emptyCrewIds={emptyCrewIds} disabled={controlsDisabled} readState={readState} onToggleCrew={onToggleCrew} onHideCrews={onHideCrews} onShowAllCrews={onShowAllCrews}/>} today={today} rangeStart={rangeStart} rangeEnd={rangeEnd}
    attentionMode={attentionMode} attentionCount={attentionCount} readState={readState} controlsDisabled={controlsDisabled}
    crews={crews} hiddenCrewIds={hiddenCrewIds} hiddenItemCount={hiddenItemCount} emptyCrewIds={emptyCrewIds}
    showCompleted={showCompleted} onAttentionModeChange={onAttentionModeChange} onShowCompletedChange={onShowCompletedChange}
    onOpenBoard={onOpenBoard} onToggleCrew={onToggleCrew} onHideCrews={onHideCrews} onShowAllCrews={onShowAllCrews}>
    {content}
  </ScheduleGanttCompactSurface>;
}
