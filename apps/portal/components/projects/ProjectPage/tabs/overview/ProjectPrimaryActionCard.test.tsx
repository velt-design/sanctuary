import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandCentreActionFixtures, commandCentreFixtureStaff } from '@/app/qa/project-command-centre-fixture/fixtures';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectPrimaryActionCard from './ProjectPrimaryActionCard';

const runProjectActionCommand = vi.fn();
const setProjectCommandOwner = vi.fn();

vi.mock('@/components/auth/PortalAuthProvider', () => ({
  usePortalSession: () => ({ user: { id: commandCentreFixtureStaff[0].userId }, isAdmin: false }),
}));
vi.mock('@/lib/projects/commandCentre/client', () => ({
  fetchProjectStaffDirectory: vi.fn().mockResolvedValue(commandCentreFixtureStaff),
  runProjectActionCommand: (...args: unknown[]) => runProjectActionCommand(...args),
  setProjectCommandOwner: (...args: unknown[]) => setProjectCommandOwner(...args),
}));

function renderCard(scenario: keyof typeof commandCentreActionFixtures) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderIntoDocument(
    <QueryClientProvider client={client}>
      <ProjectPrimaryActionCard
        projectId="proj_fixture"
        host="fixture"
        operations={commandCentreActionFixtures[scenario]}
        stale={false}
        onRefresh={vi.fn()}
        initialStaff={commandCentreFixtureStaff}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectPrimaryActionCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    runProjectActionCommand.mockReset().mockResolvedValue({ command: { id: 'command', committed: true } });
    setProjectCommandOwner.mockReset();
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('keeps action title, owner, due state, source and single project owner visible', () => {
    const rendered = renderCard('primary');
    expect(rendered.container.textContent).toContain('Finalise and send quote');
    expect(rendered.container.textContent).toContain('Sam Sales');
    expect(rendered.container.textContent).toContain('Overdue');
    expect(rendered.container.textContent).toContain('Automation task');
    expect(rendered.container.querySelectorAll('[data-project-owner]').length).toBe(1);
    expect(rendered.container.textContent).toContain('Jordan');
    rendered.unmount();
  });

  it('renders explicit no-action and undated selectable-work states truthfully', () => {
    const empty = renderCard('empty');
    expect(empty.container.querySelector('[data-primary-action-state="empty"]')).not.toBeNull();
    expect(empty.container.textContent).toContain('No next action has been set');
    empty.unmount();

    const undated = renderCard('undated');
    expect(undated.container.textContent).toContain('Due date required');
    undated.unmount();
  });

  it('uses non-colour critical and conflict text and freezes conflicting controls', () => {
    const critical = renderCard('critical');
    expect(critical.container.textContent).toContain('Critical');
    expect(critical.container.textContent).toContain('Customer cannot proceed without a revised quote');
    critical.unmount();

    const conflict = renderCard('conflict');
    expect(conflict.container.querySelector('[role="alert"]')?.textContent).toContain('Primary-action review required');
    expect(conflict.container.textContent).toContain('An admin must resolve this');
    expect(Array.from(conflict.container.querySelectorAll('button')).some((button) => button.textContent === 'Reschedule')).toBe(false);
    conflict.unmount();
  });

  it('audits inline history and sends completion only once per click', async () => {
    const rendered = renderCard('primary');
    expect(rendered.container.querySelectorAll('li').length).toBe(5);
    const complete = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Complete')!;
    await act(async () => { complete.click(); });
    expect(runProjectActionCommand).toHaveBeenCalledTimes(1);
    expect(runProjectActionCommand).toHaveBeenCalledWith('proj_fixture', expect.objectContaining({ command: 'complete' }));
    rendered.unmount();
  });

  it('preserves the displayed action owner when reassign is clicked without changing the selection', async () => {
    await import('./ProjectPrimaryActionControls');
    const rendered = renderCard('primary');
    const manage = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Manage next action')!;
    await act(async () => {
      manage.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const ownerSelect = Array.from(rendered.container.querySelectorAll('select')).find((select) => (
      select.parentElement?.textContent?.includes('Action owner')
    ))!;
    expect(ownerSelect.value).toBe(commandCentreFixtureStaff[0].userId);
    const reassign = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Reassign')!;
    await act(async () => { reassign.click(); });
    expect(runProjectActionCommand).toHaveBeenCalledWith('proj_fixture', expect.objectContaining({
      command: 'reassign',
      ownerUserId: commandCentreFixtureStaff[0].userId,
    }));
    rendered.unmount();
  });
});
