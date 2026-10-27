import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { CommercialProjectNotice, ProjectCommercialProvider, useProjectCommercialContext } from './ProjectCommercialContext';
import CommercialTabSurface from './tabs/CommercialTabSurface';

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
  it('has no unlabeled routine feedback when verified active commercial work is available',()=>{
    const result=renderIntoDocument(<ProjectCommercialProvider projectId="active-project" work={work('ACTIVE')} ready><CommercialProjectNotice compact projectId="active-project" view="invoices"/></ProjectCommercialProvider>);
    expect(result.container.querySelector('[data-project-read-feedback]')).toBeNull();result.unmount();
  });
  it('retains one allocated notice owner and visible review action while full details stay local', () => {
    const root = (ready: boolean) => <CommercialTabSurface view="quotes" onSelect={() => undefined}
      notice={ready ? <ProjectCommercialProvider projectId="current-project" work={work('WAITING')} ready>
        <CommercialProjectNotice compact projectId="current-project" view="quotes" /><Action />
      </ProjectCommercialProvider> : null}><input aria-label="Find quotes" /></CommercialTabSurface>;
    const result = renderIntoDocument(root(false));
    const input = result.container.querySelector('input')!;
    const notice = input.previousElementSibling;
    result.rerender(root(true));
    expect(input.previousElementSibling).toBe(notice);
    expect(result.container.querySelector('input')).toBe(input);
    expect(result.container.querySelector('[aria-live="polite"]')?.textContent).toBeTruthy();
    const review = [...result.container.querySelectorAll('button')].find(button => button.textContent === 'Review commercial actions')!;
    expect([...result.container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Send agreement')?.disabled).toBe(true);
    act(() => review.click());
    expect([...result.container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Send agreement')?.disabled).toBe(false);
    act(() => result.container.querySelector<HTMLButtonElement>('[data-project-read-feedback] button[aria-haspopup="dialog"]')!.click());
    expect(document.body.textContent).toContain('Project work is on hold. Check the reason and agreed next step');
    expect(document.body.querySelector('[href="/staff/projects/current-project?tab=invoices"]')).not.toBeNull();
    result.rerender(root(false));
    expect(result.container.querySelector('input')).toBe(input);
    expect(document.body.textContent).not.toContain('Project work is on hold');
    result.unmount();
  });
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
