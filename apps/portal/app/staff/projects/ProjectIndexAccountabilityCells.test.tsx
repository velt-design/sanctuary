import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { Table, TableBody, TableRow } from '@/components/ui/foundation';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { ProjectsIndexProject } from '@/lib/projects/projectsIndexContract';
import ProjectIndexAccountabilityCells from './ProjectIndexAccountabilityCells';

function project(
  overrides: Partial<ProjectsIndexProject> = {},
): ProjectsIndexProject {
  return {
    id: 'proj_1',
    createdAt: '2026-07-31T00:00:00.000Z',
    projectName: 'Deck Build',
    status: 'QUOTING',
    effectiveState: 'ACTIVE',
    projectOwnerKey: null,
    nextAction: null,
    ...overrides,
  };
}

function renderCells(value: ProjectsIndexProject) {
  return renderIntoDocument(
    <Table>
      <TableBody>
        <TableRow>
          <ProjectIndexAccountabilityCells project={value} />
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe('ProjectIndexAccountabilityCells', () => {
  it('shows accountable owner and the same semantic due wording as Work Queue', () => {
    const rendered = renderCells(
      project({
        projectOwnerKey: 'jordan',
        nextAction: {
          title: 'Finalise and send the draft quote',
          reason: 'Ready now. The current estimate is ready.',
          dueAt: null,
          group: 'today',
          actionKind: 'specialist',
          href: '/staff/projects/proj_1?tab=quotes',
        },
      }),
    );
    expect(rendered.container.textContent).toContain('Jordan');
    expect(rendered.container.textContent).toContain(
      'Finalise and send the draft quote',
    );
    expect(rendered.container.textContent).toContain('When: Ready now');
    rendered.unmount();
  });

  it('opens and closes supporting attention without opening the project row', () => {
    const open = vi.fn();
    const rendered = renderIntoDocument(<Table><TableBody><TableRow onClick={open}>
      <ProjectIndexAccountabilityCells project={project()} />
    </TableRow></TableBody></Table>);
    act(() => rendered.container.querySelector<HTMLButtonElement>('[aria-label="Attention details for Deck Build"]')!.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Open the project to review future work');
    act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(open).not.toHaveBeenCalled();
    act(() => rendered.container.querySelector<HTMLButtonElement>('[aria-label="Attention details for Deck Build"]')!.click());
    act(() => document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(open).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('uses human closed outcome language and calls out missing ownership', () => {
    const closed = renderCells(
      project({
        status: 'CONTACTED',
        effectiveState: 'CLOSED',
        closedOutcome: 'LOST_TIMING_DEFERRED',
      }),
    );
    expect(closed.container.textContent).toContain('Unassigned');
    expect(closed.container.textContent).toContain('Closed: Lost - Timing deferred');
    closed.unmount();
  });
});
