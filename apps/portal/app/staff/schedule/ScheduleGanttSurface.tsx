'use client';

import { formatShortDate, normalizeGanttZoomWeeks } from './ScheduleGanttCalendarModel';
import ScheduleGanttCalendar from './ScheduleGanttCalendar';
import ScheduleGanttToolbar from './ScheduleGanttToolbar';
import ScheduleGanttCompactSurface from './ScheduleGanttCompactSurface';
import { useScheduleSurfaceController, useScheduleSurfaceEvidence } from './ScheduleSurfaceContext';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
import timelineStyles from './scheduleTimeline.module.css';

const styles = { ...sharedStyles, ...timelineStyles, ...ganttStyles };
const noAction = () => undefined;
const noCrews: [] = [];
const noHidden = new Set<string>();
export type ScheduleGanttSurfaceProps = {
  today: string; showCompleted: boolean; onShowCompletedChange: (next: boolean) => void;
  onOpenUnscheduled: (control: HTMLButtonElement) => void;
  dataError?: boolean; scheduleMode?: 'v2' | 'legacy';
};

export default function ScheduleGanttSurface({ today, showCompleted, onShowCompletedChange, onOpenUnscheduled,
  dataError = false, scheduleMode = 'v2' }: ScheduleGanttSurfaceProps) {
  const surface = useScheduleSurfaceController()!;
  const viewport = surface.gantt;
  const published = useScheduleSurfaceEvidence().gantt;
  const evidence = published?.calendar.displayToday === viewport.gantt.displayToday
    && published.calendar.axis.baseDayPx === viewport.gantt.axis.baseDayPx ? published : null;
  const calendar = evidence?.calendar ?? viewport.gantt;
  const readState = evidence?.toolbar.readState ?? (evidence ? undefined : dataError ? 'unavailable' : 'pending');
  const roster = evidence?.toolbar ?? { crews: noCrews, hiddenCrewIds: noHidden, hiddenItemCount: 0, emptyCrewIds: noCrews,
    attentionCount: null, controlsDisabled: false, onToggleCrew: noAction, onHideCrews: noAction, onShowAllCrews: noAction };
  const pending = <div role="status" className={viewport.compactMode ? styles.ganttCompactEmpty : styles.ganttEmptyState}
    aria-label={viewport.compactMode ? undefined : 'Gantt empty state'}>
    <strong>{dataError ? 'Schedule unavailable' : 'Reading crews and scheduled work…'}</strong>
    <span>{dataError ? 'Retry to load this schedule.' : 'Scheduled work appears when the read completes.'}</span>
  </div>;
  return <div ref={viewport.ganttRootRef} className={styles.gantt} data-layout-mode={viewport.ganttLayoutMode}
    aria-busy={readState === 'pending'}>
    {viewport.compactMode ? <ScheduleGanttCompactSurface {...roster}
      today={today} rangeStart={calendar.rangeStart} rangeEnd={calendar.rangeEnd} readState={readState}
      showCompleted={showCompleted} attentionMode={viewport.attentionMode}
      onAttentionModeChange={evidence?.compact.onAttentionModeChange ?? viewport.setAttentionMode}
      onShowCompletedChange={onShowCompletedChange} onOpenBoard={onOpenUnscheduled}>
      <div style={{ display: 'contents' }} ref={surface.slotRefs.compactRows}>{!evidence ? pending : null}</div>
    </ScheduleGanttCompactSurface> : <>
      <ScheduleGanttToolbar {...roster} rangeStartLabel={formatShortDate(calendar.rangeStart)}
        rangeEndLabel={formatShortDate(calendar.rangeEnd)} zoomWeeks={viewport.zoomWeeks} density={viewport.ganttDensity}
        scheduleMode={scheduleMode} showCompleted={showCompleted} showPlanned={viewport.showPlanned}
        attentionMode={viewport.attentionMode} readState={readState}
        onZoomWeeksChange={next => viewport.handleGanttZoomWeeksChange(normalizeGanttZoomWeeks(next))}
        onDensityChange={viewport.setGanttDensity} onShowCompletedChange={onShowCompletedChange}
        onShowPlannedChange={viewport.setShowPlanned} onAttentionModeChange={evidence?.toolbar.onAttentionModeChange ?? viewport.setAttentionMode}
        onJumpToToday={viewport.jumpGanttToToday} onOpenUnscheduled={onOpenUnscheduled} />
      <ScheduleGanttCalendar gantt={calendar} density={viewport.ganttDensity} labelWidthPx={viewport.labelWidthPx}
        labelWidthBounds={viewport.labelWidthBounds} labelResizeActive={Boolean(viewport.ganttLabelResize)}
        snapGuidePx={evidence?.snapGuidePx ?? null} scrollRef={viewport.ganttScrollRef}
        onBeginLabelResize={viewport.beginGanttLabelResize} onLabelResizeKeyDown={viewport.handleGanttLabelResizeKeyDown}
        rows={<div style={{ display: 'contents' }} ref={surface.slotRefs.timelineRows} />}
        empty={<div style={{ display: 'contents' }} ref={surface.slotRefs.timelineEmpty}>{!evidence ? pending : null}</div>} />
    </>}
    {evidence?.overlays}
  </div>;
}
