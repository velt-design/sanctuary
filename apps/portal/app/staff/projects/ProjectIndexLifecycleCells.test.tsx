import { describe, expect, it, vi } from 'vitest';
import { Table, TableBody, TableRow } from '@/components/ui/foundation';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexLifecycleCells from './ProjectIndexLifecycleCells';

const project = { id: 'proj_1', createdAt: '2026-07-31T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z', status: 'SENT', effectiveState: 'WAITING' } as const;
describe('Project lifecycle summary', () => {
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
});
