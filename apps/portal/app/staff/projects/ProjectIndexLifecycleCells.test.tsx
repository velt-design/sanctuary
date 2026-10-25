import { describe, expect, it, vi } from 'vitest';
import { Table, TableBody, TableRow } from '@/components/ui/foundation';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexLifecycleCells from './ProjectIndexLifecycleCells';
import * as age from './projectStageAge';

const project = { id: 'proj_1', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z', status: 'SENT', effectiveState: 'WAITING' } as const;
describe('Project lifecycle summary', () => {
  it('shows only Closed and does not present the former stage age as time closed', () => {
    const rendered = renderIntoDocument(<Table><TableBody><TableRow><ProjectIndexLifecycleCells project={{ ...project, effectiveState: 'CLOSED', stageChangedAt: '2026-09-20T13:00:00Z' }} /></TableRow></TableBody></Table>);
    expect(rendered.container.querySelector('[data-column="Stage"]')?.textContent).toBe('Closed');
    expect(rendered.container.querySelector('[data-column="Time in stage"]')?.textContent).toBe('—');
    rendered.unmount();
  });
  it('combines stage and exception state without inferring an age from other dates', () => {
    const rendered = renderIntoDocument(<Table><TableBody><TableRow><ProjectIndexLifecycleCells project={project} /></TableRow></TableBody></Table>);
    expect(rendered.container.querySelector('[data-column="Stage"]')?.textContent).toContain('Waiting');
    expect(rendered.container.querySelector('[data-column="Time in stage"]')?.textContent).toContain('Unknown');
    expect(rendered.container.querySelector('[data-column="Journey"]')).toBeNull();
    rendered.unmount();
  });
  it('renders age and the Auckland recorded date when evidence is known', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T01:00:00Z'));
    const rendered = renderIntoDocument(<Table><TableBody><TableRow><ProjectIndexLifecycleCells project={{ ...project, stageChangedAt: '2026-09-20T13:00:00Z' }} /></TableRow></TableBody></Table>);
    expect(rendered.container.querySelector('[data-column="Time in stage"]')?.textContent).toContain('2 days');
    expect(rendered.container.querySelector('time')?.textContent).toBe('21 Sept 2026');
    rendered.unmount(); vi.useRealTimers();
  });
  it('keeps missing state explicit', () => {
    const rendered = renderIntoDocument(<Table><TableBody><TableRow><ProjectIndexLifecycleCells project={{ ...project, effectiveState: undefined }} /></TableRow></TableBody></Table>);
    expect(rendered.container.textContent).toContain('State unavailable');
    rendered.unmount();
  });
  it('does not derive discarded CLOSED ages and resumes the original current age when the same row reopens', () => {
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-23T01:00:00Z'));
    const derive=vi.spyOn(age,'projectStageAge');
    const item={...project,stageChangedAt:'2026-09-20T13:00:00Z'};
    const tree=(state:'CLOSED'|'WAITING'|'ARCHIVED')=><Table><TableBody><TableRow><ProjectIndexLifecycleCells project={{...item,effectiveState:state}}/></TableRow></TableBody></Table>;
    const rendered=renderIntoDocument(tree('CLOSED'));
    try {
      expect(derive).not.toHaveBeenCalled();
      expect(rendered.container.querySelector('[aria-label="Time in stage not applicable for closed projects"]')?.textContent).toBe('—');
      const cell=rendered.container.querySelector('[data-column="Time in stage"]');
      rendered.rerender(tree('WAITING'));
      expect(derive).toHaveBeenCalledOnce();expect(derive).toHaveBeenCalledWith(item.stageChangedAt);
      expect(cell?.textContent).toContain('2 days');expect(cell?.querySelector('time')?.textContent).toBe('21 Sept 2026');
      rendered.rerender(tree('CLOSED'));expect(derive).toHaveBeenCalledOnce();expect(cell?.textContent).toBe('—');
      rendered.rerender(tree('ARCHIVED'));expect(derive).toHaveBeenCalledTimes(2);expect(cell?.textContent).toContain('2 days');
      expect(rendered.container.querySelector('[data-column="Time in stage"]')).toBe(cell);
    } finally {rendered.unmount();derive.mockRestore();vi.useRealTimers();}
  });
});
