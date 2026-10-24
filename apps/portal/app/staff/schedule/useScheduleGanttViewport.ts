'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { diffDaysYmd } from '@/lib/scheduling/date';
import { axisXForDayIndex } from './ganttAxis';
import { buildScheduleGanttCalendar, GANTT_DEFAULT_ZOOM_WEEKS, GANTT_LABEL_DEFAULT_PX, GANTT_LABEL_KEYBOARD_STEP_PX, clampGanttLabelWidthToBounds, ganttLabelWidthBoundsForViewport, prefersReducedMotion, readGanttDensityPreference, readGanttLabelWidthPreference, writeGanttDensityPreference, writeGanttLabelWidthPreference, type GanttZoomWeeks, type GanttDensity, type GanttLabelWidthBounds } from './ScheduleGanttCalendarModel';
import { useScheduleGanttLayoutMode } from './useScheduleGanttLayoutMode';
import { useScheduleGanttInitialScroll } from './useScheduleGanttInitialScroll';

/** Date/viewport controls exist independently of crew, estimate and action reads. */
export function useScheduleGanttViewport(today: string, active = true) {
  const { rootRef: ganttRootRef, mode: ganttLayoutMode } = useScheduleGanttLayoutMode(active);
  const compactMode = ganttLayoutMode !== 'timeline';
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const labelWidthPxRef = useRef(GANTT_LABEL_DEFAULT_PX);
  const pendingZoomAnchorRef = useRef<{ date: string; viewportOffsetPx: number } | null>(null);
  const [zoomWeeks, setZoomWeeks] = useState<GanttZoomWeeks>(GANTT_DEFAULT_ZOOM_WEEKS);
  const [ganttDensity, setGanttDensity] = useState<GanttDensity>(() => readGanttDensityPreference());
  const [preferredLabelWidthPx, setPreferredLabelWidthPx] = useState<number>(() => readGanttLabelWidthPreference());
  const [narrowLabelWidthPx, setNarrowLabelWidthPx] = useState<number | null>(null);
  const [ganttViewportWidthPx, setGanttViewportWidthPx] = useState(0);
  const [showPlanned, setShowPlanned] = useState(true);
  const [attentionMode, setAttentionMode] = useState<'all' | 'attention'>('all');
  const [ganttLabelResize, setGanttLabelResize] = useState<{startX: number; startWidth: number; bounds: GanttLabelWidthBounds} | null>(null);
  const gantt = useMemo(() => buildScheduleGanttCalendar({ today, zoomWeeks }), [today, zoomWeeks]);
  const labelWidthBounds = useMemo(() => ganttLabelWidthBoundsForViewport(ganttViewportWidthPx), [ganttViewportWidthPx]);
  const labelWidthPx = clampGanttLabelWidthToBounds(
    labelWidthBounds.narrow ? narrowLabelWidthPx ?? labelWidthBounds.max : preferredLabelWidthPx,
    labelWidthBounds,
  );

  const applyInteractiveLabelWidth = useCallback((value: number, bounds: GanttLabelWidthBounds) => {
    const next = clampGanttLabelWidthToBounds(value, bounds);
    labelWidthPxRef.current = next;
    if (bounds.narrow) {
      setNarrowLabelWidthPx(next);
      return next;
    }
    setPreferredLabelWidthPx(next);
    return next;
  }, []);

  useEffect(() => { writeGanttDensityPreference(ganttDensity); }, [ganttDensity]);
  useEffect(() => { labelWidthPxRef.current = labelWidthPx; }, [labelWidthPx]);
  useScheduleGanttInitialScroll(ganttScrollRef, gantt.todayLinePx, labelWidthPx);
  useLayoutEffect(() => {
    if (!active || compactMode) return;
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const updateViewportWidth = () => {
      const next = Math.max(0, Math.floor(scroller.clientWidth));
      setGanttViewportWidthPx((current) => (current === next ? current : next));
    };
    updateViewportWidth();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateViewportWidth) : null;
    observer?.observe(scroller);
    window.addEventListener('resize', updateViewportWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateViewportWidth);
    };
  }, [active, compactMode]);

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) return;
    const scroller = ganttScrollRef.current;
    if (!scroller || gantt.axis.rangeDays <= 0) {
      pendingZoomAnchorRef.current = null;
      return;
    }
    const rawIndex = diffDaysYmd(gantt.rangeStart, anchor.date);
    const dayIndex = Math.max(0, Math.min(gantt.axis.rangeDays - 1, rawIndex));
    const nextTodayAbsolutePx = labelWidthPx + axisXForDayIndex(gantt.axis, dayIndex);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.max(0, Math.min(maxLeft, nextTodayAbsolutePx - anchor.viewportOffsetPx));
    pendingZoomAnchorRef.current = null;
  }, [gantt.axis.boundaryPx, gantt.axis.rangeDays, gantt.rangeStart, gantt.totalWidth, labelWidthPx, zoomWeeks]);

  useEffect(() => {
    if (!ganttLabelResize) return;
    const onMove = (event: PointerEvent) => {
      applyInteractiveLabelWidth(ganttLabelResize.startWidth + event.clientX - ganttLabelResize.startX, ganttLabelResize.bounds);
    };
    const onUp = () => {
      if (!ganttLabelResize.bounds.narrow) writeGanttLabelWidthPreference(labelWidthPxRef.current);
      setGanttLabelResize(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [applyInteractiveLabelWidth, ganttLabelResize]);

  const handleGanttZoomWeeksChange = useCallback((next: GanttZoomWeeks) => {
    if (next === zoomWeeks) return;
    const scroller = ganttScrollRef.current;
    if (scroller && gantt.axis.rangeDays > 0) {
      const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
      const todayViewportOffsetPx = labelWidthPx + gantt.todayLinePx - scroller.scrollLeft;
      const minVisiblePx = labelWidthPx + 8;
      const maxVisiblePx = Math.max(minVisiblePx, scroller.clientWidth - 8);
      const fallbackVisiblePx = labelWidthPx + timelineViewportWidth * 0.3;
      pendingZoomAnchorRef.current = {
        date: gantt.displayToday,
        viewportOffsetPx: todayViewportOffsetPx >= minVisiblePx && todayViewportOffsetPx <= maxVisiblePx ? todayViewportOffsetPx : fallbackVisiblePx,
      };
    }
    setZoomWeeks(next);
  }, [zoomWeeks, gantt.axis.rangeDays, gantt.displayToday, gantt.todayLinePx, labelWidthPx]);

  const jumpGanttToToday = useCallback(() => {
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
    const todayAbsolutePx = labelWidthPx + gantt.todayLinePx;
    const targetLeft = Math.max(0, todayAbsolutePx - (labelWidthPx + timelineViewportWidth * 0.3));
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollTo({
      left: Math.min(maxLeft, targetLeft),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [labelWidthPx, gantt.todayLinePx]);

  const beginGanttLabelResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setGanttLabelResize({ startX: event.clientX, startWidth: labelWidthPx, bounds: labelWidthBounds });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  }, [labelWidthPx, labelWidthBounds]);

  const handleGanttLabelResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? GANTT_LABEL_KEYBOARD_STEP_PX * 2 : GANTT_LABEL_KEYBOARD_STEP_PX;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = labelWidthPx - step;
    if (event.key === 'ArrowRight') next = labelWidthPx + step;
    if (event.key === 'Home') next = labelWidthBounds.min;
    if (event.key === 'End') next = labelWidthBounds.max;
    if (next == null) return;
    event.preventDefault();
    event.stopPropagation();
    const applied = applyInteractiveLabelWidth(next, labelWidthBounds);
    if (!labelWidthBounds.narrow) writeGanttLabelWidthPreference(applied);
  }, [labelWidthPx, labelWidthBounds, applyInteractiveLabelWidth]);

  return useMemo(() => ({ ganttRootRef, ganttLayoutMode, compactMode, ganttScrollRef, zoomWeeks, ganttDensity, setGanttDensity, showPlanned, setShowPlanned, attentionMode, setAttentionMode, labelWidthPx, labelWidthBounds, ganttLabelResize, gantt, handleGanttZoomWeeksChange, jumpGanttToToday, beginGanttLabelResize, handleGanttLabelResizeKeyDown }),
    [ganttRootRef, ganttLayoutMode, compactMode, zoomWeeks, ganttDensity, showPlanned, attentionMode,
      labelWidthPx, labelWidthBounds, ganttLabelResize, gantt, handleGanttZoomWeeksChange,
      jumpGanttToToday, beginGanttLabelResize, handleGanttLabelResizeKeyDown]);
}
