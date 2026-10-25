import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ScheduleCrewFilterPanel from './ScheduleCrewFilterPanel';
import ScheduleBoardSurface from './ScheduleBoardSurface';
import { ScheduleSurfaceProvider, useScheduleSurfaceController, type BoardSurfaceEvidence } from './ScheduleSurfaceContext';
import { buildScheduleGanttCalendar } from './ScheduleGanttCalendarModel';
import { buildScheduleGanttModel } from './ScheduleGanttModel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

it('rejects a retired producer publication and cleanup without replacing the new source evidence', () => {
  const storageRead = vi.spyOn(Storage.prototype, 'getItem');
  const publishers: Array<(value: BoardSurfaceEvidence | null) => void> = [];
  function Producer() {
    const publish = useScheduleSurfaceController()!.publishBoard;
    if (publishers.at(-1) !== publish) publishers.push(publish);
    return null;
  }
  const props = { query: '', unscheduledCollapsed: false, showCompleted: false,
    onQueryChange: vi.fn(), onToggleUnscheduledCollapsed: vi.fn(), onShowCompletedChange: vi.fn() };
  const render = (owner: object | null) => <ScheduleSurfaceProvider owner={owner} today="2026-04-07" ganttActive={false}>
    <ScheduleBoardSurface {...props} /><Producer />
  </ScheduleSurfaceProvider>;
  const evidence = (name: string, count: number): BoardSurfaceEvidence => ({ unscheduledCount: count, visibleCrewCount: 1,
    crewFilter: { panel:<ScheduleCrewFilterPanel crews={[{id:name,name,color:'#123456',itemCount:count}]} hiddenCrewIds={new Set()} hiddenItemCount={0} emptyCrewIds={[]} onToggleCrew={vi.fn()} onHideCrews={vi.fn()} onShowAllCrews={vi.fn()}/>, crews: [{ id: name, name, color: '#123456', itemCount: count }], hiddenCrewIds: new Set(),
      hiddenItemCount: 0, emptyCrewIds: [], onToggleCrew: vi.fn(), onHideCrews: vi.fn(), onShowAllCrews: vi.fn() } });
  const view = renderIntoDocument(render({}));
  const input = view.container.querySelector('input');
  expect(storageRead.mock.calls.map(([key]) => key)).not.toContain('sp.schedule.board.hiddenCrewIds.v1');
  const first = publishers.at(-1)!;
  act(() => first(evidence('Fictional A', 2)));
  expect(view.container.textContent).toContain('Fictional A');
  view.rerender(render({}));
  expect(view.container.textContent).not.toContain('Fictional A');
  const second = publishers.at(-1)!;
  act(() => second(evidence('Fictional B', 3)));
  act(() => { first(evidence('Late A', 8)); first(null); });
  expect(view.container.textContent).toContain('Fictional B');
  expect(view.container.textContent).not.toContain('Late A');
  view.rerender(render(null));
  act(() => second(evidence('Late B', 3)));
  expect(view.container.textContent).not.toContain('Fictional B');
  expect(view.container.textContent).not.toContain('Late B');
  expect(view.container.textContent).toContain('Reading crews');
  expect(view.container.querySelector('input')).toBe(input);
  view.unmount();
});

it('keeps public date geometry identical to the private complete model without manufacturing work rows', () => {
  const today = '2026-04-07';
  const holidays = [{ date: '2026-04-06', name: 'Fictional holiday', kind: 'holiday' as const }];
  const calendar = buildScheduleGanttCalendar({ today, zoomWeeks: 8, holidays });
  expect(calendar.rangeStart).toBe('2026-03-09');
  expect(calendar.displayToday).toBe(today);
  expect(calendar.holidayBlocks[0]?.label).toContain('Fictional holiday');
  expect(calendar).not.toHaveProperty('rows');
  const full = buildScheduleGanttModel({ today, zoomWeeks: 8, holidays, scheduleMode: 'v2', installers: [],
    laneItems: new Map(), visibleScheduleItems: [], projectsById: new Map(), estimatesById: new Map(), scheduleBars: [],
    scheduleIssues: [], collapsedCrews: {}, showPlanned: true, ganttDrag: null, ganttDragDelta: 0,
    scheduleItemById: new Map(), attentionReasonsByScheduleId: new Map() });
  const { rows, ...fullCalendar } = full;
  expect(rows).toEqual([]);
  expect(fullCalendar).toEqual(calendar);
  expect(buildScheduleGanttCalendar({ today, zoomWeeks: 4 }).axis.baseDayPx).toBeGreaterThan(calendar.axis.baseDayPx);
});


it('keeps the real crew disclosure, panel and focus while guarded panel records arrive and are denied',()=>{
  const owner={};let publish!:(value:BoardSurfaceEvidence|null)=>void;
  function Producer(){publish=useScheduleSurfaceController()!.publishBoard;return null;}
  const props={query:'',unscheduledCollapsed:false,showCompleted:false,onQueryChange:vi.fn(),onToggleUnscheduledCollapsed:vi.fn(),onShowCompletedChange:vi.fn()};
  const root=(source:object|null)=><ScheduleSurfaceProvider owner={source} today="2026-04-07" ganttActive={false}><ScheduleBoardSurface {...props}/><Producer/></ScheduleSurfaceProvider>;
  const view=renderIntoDocument(root(owner));
  const summary=view.container.querySelector<HTMLElement>('summary')!,details=summary.parentElement as HTMLDetailsElement,panel=details.querySelector('div[id]');
  summary.focus();expect(summary.getAttribute('aria-disabled')).toBe('true');expect(panel?.textContent).toContain('Reading crews');
  expect(view.container.querySelector('[data-crew-id]')).toBeNull();
  const toggle=vi.fn(),hide=vi.fn(),show=vi.fn();
  const filter={crews:[{id:'crew_fictional',name:'Fictional crew',color:'#123456',itemCount:2}],hiddenCrewIds:new Set<string>(),hiddenItemCount:0,emptyCrewIds:[],onToggleCrew:toggle,onHideCrews:hide,onShowAllCrews:show};
  act(()=>publish({unscheduledCount:1,visibleCrewCount:1,crewFilter:{...filter,panel:<ScheduleCrewFilterPanel {...filter}/>}}));
  expect(view.container.querySelector('summary')).toBe(summary);expect(details.querySelector('div[id]')).toBe(panel);expect(document.activeElement).toBe(summary);expect(summary.getAttribute('aria-disabled')).toBe('false');
  act(()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
  const checkbox=view.container.querySelector<HTMLInputElement>('[data-crew-id]')!;act(()=>checkbox.click());expect(toggle).toHaveBeenCalledExactlyOnceWith('crew_fictional');
  checkbox.focus();act(()=>checkbox.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));expect(details.open).toBe(false);expect(document.activeElement).toBe(summary);
  const retired=publish;view.rerender(root(null));act(()=>retired({unscheduledCount:1,visibleCrewCount:1,crewFilter:{...filter,panel:<ScheduleCrewFilterPanel {...filter}/>}}));
  expect(view.container.querySelector('summary')).toBe(summary);expect(details.querySelector('div[id]')).toBe(panel);expect(view.container.querySelector('[data-crew-id]')).toBeNull();expect(summary.getAttribute('aria-disabled')).toBe('true');view.unmount();
});
