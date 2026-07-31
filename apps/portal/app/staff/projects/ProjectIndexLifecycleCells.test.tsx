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
              stageBusy={false}
              onCorrectStage={() => {}}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(rendered.container.querySelector('[data-column="Journey"]')?.textContent).toBe('Proposal');
    expect(rendered.container.querySelector('[data-column="State"]')?.textContent).toBe('Waiting');
    expect(rendered.container.textContent).toContain('Sent');
    expect(rendered.container.querySelector('button')?.textContent).toBe('Correct');
    rendered.unmount();
  });

  it('does not invent missing state and preserves the stage correction callback', () => {
    const onCorrectStage = vi.fn();
    const rendered = renderIntoDocument(
      <Table>
        <TableBody>
          <TableRow>
            <ProjectIndexLifecycleCells
              project={{ ...project, operationalState: undefined, effectiveState: undefined }}
              stageBusy={false}
              onCorrectStage={onCorrectStage}
            />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const button = rendered.container.querySelector('button') as HTMLButtonElement;

    act(() => {
      button.click();
    });

    expect(rendered.container.querySelector('[data-column="State"]')?.textContent).toBe('Unavailable');
    expect(onCorrectStage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj_1' }),
    );
    rendered.unmount();
  });
});
