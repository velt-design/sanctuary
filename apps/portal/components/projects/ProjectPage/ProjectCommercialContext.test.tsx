import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { CommercialProjectNotice, ProjectCommercialProvider, useProjectCommercialContext } from './ProjectCommercialContext';

function Action() {
  const { actionsAvailable } = useProjectCommercialContext();
  return <button disabled={!actionsAvailable}>Send agreement</button>;
}
function work(state: ProjectWorkProjection['effectiveState'], version = 1) {
  return { effectiveState: state, closedOutcome: 'CANCELLED', stateRowVersion: version } as ProjectWorkProjection;
}
function view(state: ProjectWorkProjection['effectiveState'], ready = true, version = 1, projectId = 'proj-synthetic') {
  return <ProjectCommercialProvider projectId={projectId} work={work(state, version)} ready={ready}>
    <CommercialProjectNotice projectId={projectId} view="quotes" /><Action />
  </ProjectCommercialProvider>;
}
describe('current-state commercial presentation', () => {
  it.each(['CLOSED', 'ARCHIVED', 'WAITING'] as const)('makes %s actions deliberate without changing record facts', (state) => {
    const result = renderIntoDocument(view(state));
    const action = () => [...result.container.querySelectorAll('button')].find((node) => node.textContent === 'Send agreement')!;
    expect(action().disabled).toBe(true);
    expect(result.container.textContent).toContain('Review commercial actions');
    act(() => [...result.container.querySelectorAll('button')].find((node) => node.textContent === 'Review commercial actions')!.click());
    expect(action().disabled).toBe(false);
    result.rerender(view(state, true, 2));
    expect(action().disabled).toBe(true);
    result.unmount();
  });
  it('keeps active/completed work available but never authorises against an unfinished current-state read', () => {
    const result = renderIntoDocument(view('ACTIVE'));
    expect(result.container.querySelector('button')?.disabled).toBe(false);
    result.rerender(view('ACTIVE', false));
    expect(result.container.textContent).toContain('Commercial actions paused');
    expect(result.container.querySelector('button')?.disabled).toBe(true);
    result.rerender(view('ACTIVE', true));
    expect(result.container.querySelector('button')?.disabled).toBe(false);
    result.unmount();
  });
});

it('does not claim saved records or an unfinished read when no initial project evidence exists',()=>{
  const result=renderIntoDocument(<ProjectCommercialProvider projectId="proj-unknown" ready={false}>
    <CommercialProjectNotice projectId="proj-unknown" view="quotes"/><Action/>
  </ProjectCommercialProvider>);
  expect(result.container.textContent).toContain('verified current project state');
  expect(result.container.textContent).not.toContain('Saved records');
  expect(result.container.textContent).not.toContain('finish loading');
  expect(result.container.querySelector('button')?.disabled).toBe(true);result.unmount();
});
