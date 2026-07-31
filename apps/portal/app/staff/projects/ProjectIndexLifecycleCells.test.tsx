import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Table, TableBody, TableRow } from '@/components/ui/foundation';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectIndexLifecycleCells from './ProjectIndexLifecycleCells';

const project = {
  id: 'proj_1',
  createdAt: '2026-07-31T00:00:00.000Z',
  projectName: 'Deck Build',
  status: 'SENT',
  operationalState: 'WAITING',
  effectiveState: 'WAITING',
} as const;

describe('ProjectIndexLifecycleCells', () => {
  it('renders canonical journey, detailed stage, and server-owned state', () => {
    const rendered = renderIntoDocument(
      <Table>
        <TableBody>
          <TableRow>
            <ProjectIndexLifecycleCells
              project={project}
              projectName="Deck Build"
              stageBusy={false}
              onStageChange={() => {}}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(rendered.container.querySelector('[data-column="Journey"]')?.textContent).toBe('Proposal');
    expect(rendered.container.querySelector('[data-column="State"]')?.textContent).toBe('Waiting');
    expect(
      (rendered.container.querySelector('select[aria-label="Stage for Deck Build"]') as HTMLSelectElement)
        .value,
    ).toBe('SENT');
    rendered.unmount();
  });

  it('does not invent missing state and preserves the stage correction callback', () => {
    const onStageChange = vi.fn();
    const rendered = renderIntoDocument(
      <Table>
        <TableBody>
          <TableRow>
            <ProjectIndexLifecycleCells
              project={{ ...project, operationalState: undefined, effectiveState: undefined }}
              projectName="Deck Build"
              stageBusy={false}
              onStageChange={onStageChange}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const select = rendered.container.querySelector('select') as HTMLSelectElement;

    act(() => {
      select.value = 'DEPOSIT';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(rendered.container.querySelector('[data-column="State"]')?.textContent).toBe('Unavailable');
    expect(onStageChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj_1' }),
      'DEPOSIT',
    );
    rendered.unmount();
  });
});
