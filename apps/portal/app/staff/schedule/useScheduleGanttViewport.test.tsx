import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { useScheduleGanttViewport } from './useScheduleGanttViewport';
import { axisXForDayIndex } from './ganttAxis';
import { diffDaysYmd } from '@/lib/scheduling/date';

afterEach(() => { document.body.innerHTML = ''; window.localStorage.clear(); vi.restoreAllMocks(); });

it('retains viewport identity on unrelated renders and uses current date, scale and label bounds in callbacks', () => {
  let current!: ReturnType<typeof useScheduleGanttViewport>;
  const scrollTo = vi.fn();
  function Probe({ today }: { today: string }) {
    current = useScheduleGanttViewport(today);
    return <div ref={node => {
      current.ganttRootRef.current = node;
      if (node) Object.defineProperties(node, { clientWidth: { configurable: true, value: 1100 }, clientHeight: { configurable: true, value: 700 } });
    }}><div ref={node => {
      current.ganttScrollRef.current = node;
      if (node) Object.defineProperties(node, { clientWidth: { configurable: true, value: 1000 }, scrollWidth: { configurable: true, value: 9000 }, scrollTo: { configurable: true, value: scrollTo } });
    }} /></div>;
  }
  const view = renderIntoDocument(<Probe today="2026-04-07" />);
  const first = current;
  view.rerender(<Probe today="2026-04-07" />);
  expect(current).toBe(first);
  const scroller = current.ganttScrollRef.current!;
  scroller.scrollLeft = 120;
  const beforeZoom = current;
  const originalOffset = beforeZoom.labelWidthPx + beforeZoom.gantt.todayLinePx - scroller.scrollLeft;
  act(() => current.handleGanttZoomWeeksChange(4));
  expect(current.zoomWeeks).toBe(4);
  expect(current).not.toBe(first);
  const dayIndex = diffDaysYmd(current.gantt.rangeStart, beforeZoom.gantt.displayToday);
  expect(scroller.scrollLeft).toBeCloseTo(current.labelWidthPx + axisXForDayIndex(current.gantt.axis, dayIndex) - originalOffset);
  const atFour = current;
  act(() => current.handleGanttZoomWeeksChange(4));
  expect(current).toBe(atFour);
  act(() => current.handleGanttZoomWeeksChange(12));
  expect(current.zoomWeeks).toBe(12);
  view.rerender(<Probe today="2026-05-12" />);
  expect(current.gantt.displayToday).toBe('2026-05-12');
  act(() => current.jumpGanttToToday());
  expect(scrollTo).toHaveBeenLastCalledWith({
    left: Math.max(0, current.labelWidthPx + current.gantt.todayLinePx - (current.labelWidthPx + (1000 - current.labelWidthPx) * 0.3)),
    behavior: 'smooth',
  });
  const startWidth = current.labelWidthPx;
  const keyboard = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.KeyboardEvent<HTMLDivElement>);
  act(() => current.handleGanttLabelResizeKeyDown(keyboard('ArrowRight')));
  expect(current.labelWidthPx).toBe(startWidth + 10);
  act(() => current.handleGanttLabelResizeKeyDown(keyboard('ArrowRight', true)));
  expect(current.labelWidthPx).toBe(startWidth + 30);
  const preventDefault = vi.fn();
  act(() => current.beginGanttLabelResize({ button: 0, clientX: 200, preventDefault, stopPropagation: vi.fn(), currentTarget: { setPointerCapture: vi.fn() }, pointerId: 1 } as unknown as React.PointerEvent<HTMLDivElement>));
  expect(current.ganttLabelResize?.startWidth).toBe(startWidth + 30);
  expect(preventDefault).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new MouseEvent('pointermove', { clientX: 225 })));
  expect(current.labelWidthPx).toBe(startWidth + 55);
  act(() => window.dispatchEvent(new Event('pointerup')));
  expect(current.ganttLabelResize).toBeNull();
  expect(window.localStorage.getItem('sp.schedule.ganttLabelWidth')).toBe(String(startWidth + 55));
  act(() => current.setGanttDensity('compact'));
  expect(current.ganttDensity).toBe('compact');
  expect(window.localStorage.getItem('sp.schedule.ganttDensity')).toBe('compact');
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 250 });
  act(() => window.dispatchEvent(new Event('resize')));
  expect(current.labelWidthBounds.narrow).toBe(true);
  act(() => current.handleGanttLabelResizeKeyDown(keyboard('End')));
  expect(current.labelWidthPx).toBe(current.labelWidthBounds.max);
  act(() => current.handleGanttLabelResizeKeyDown(keyboard('Home')));
  expect(current.labelWidthPx).toBe(current.labelWidthBounds.min);
  // Narrow viewport changes must not overwrite the saved desktop width.
  expect(window.localStorage.getItem('sp.schedule.ganttLabelWidth')).toBe(String(startWidth + 55));
  view.unmount();
});
