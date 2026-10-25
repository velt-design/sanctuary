import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { Table, TableBody, TableRow } from '@/components/ui/foundation';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { ProjectsIndexProject } from '@/lib/projects/projectsIndexContract';
import ProjectIndexAccountabilityCells from './ProjectIndexAccountabilityCells';
const { drawerRender } = vi.hoisted(() => ({ drawerRender: vi.fn() }));
vi.mock('@/components/ui/drawer/Drawer', async (original) => {
  const actual = await original<typeof import('@/components/ui/drawer/Drawer')>();
  return { ...actual, Drawer: (props: React.ComponentProps<typeof actual.Drawer>) => {
    drawerRender(props); return <actual.Drawer {...props} />;
  } };
});

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
    expect(rendered.container.textContent).toContain('Ready now');
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

  it('mounts only requested attention, preserves focus and shows current evidence after close', () => {
    drawerRender.mockClear();
    const rendered = renderCells(project());
    const trigger = rendered.container.querySelector<HTMLButtonElement>('[aria-label="Attention details for Deck Build"]')!;
    try {
      expect(drawerRender).not.toHaveBeenCalled();
      act(() => trigger.focus()); act(() => trigger.click());
      expect(drawerRender).toHaveBeenCalledWith(expect.objectContaining({ open: true, title: 'Next attention' }));
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Open the project to review future work');
      act(() => document.querySelector('[data-drawer-overlay]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
      drawerRender.mockClear();
      rendered.rerender(<Table><TableBody><TableRow><ProjectIndexAccountabilityCells project={project({ effectiveState: 'WAITING', waitingReason: 'Current waiting evidence' })} /></TableRow></TableBody></Table>);
      expect(drawerRender).not.toHaveBeenCalled();
      act(() => trigger.click());
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Current waiting evidence');
      act(() => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    } finally { rendered.unmount(); }
  });
});
