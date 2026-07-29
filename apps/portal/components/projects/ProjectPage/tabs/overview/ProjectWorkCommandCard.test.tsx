import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectCommandOwnerSummary } from '@/lib/projects/commandCentre/types';
import type { ProjectWorkItem, ProjectWorkProjection } from '@/lib/projects/workItems/types';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectWorkCommandCard from './ProjectWorkCommandCard';

const runProjectWorkItemCommand = vi.fn();
const runProjectConfirmationCommand = vi.fn();
const runProjectStateCommand = vi.fn();
const setProjectCommandOwner = vi.fn();

vi.mock('@/lib/projects/workItems/client', () => ({
  runProjectWorkItemCommand: (...args: unknown[]) => runProjectWorkItemCommand(...args),
  runProjectConfirmationCommand: (...args: unknown[]) => runProjectConfirmationCommand(...args),
  runProjectStateCommand: (...args: unknown[]) => runProjectStateCommand(...args),
}));

vi.mock('@/lib/projects/commandCentre/client', () => ({
  setProjectCommandOwner: (...args: unknown[]) => setProjectCommandOwner(...args),
}));

const owner: ProjectCommandOwnerSummary = {
  owner: { key: 'jordan', displayName: 'Jordan' },
  required: true,
  missing: false,
  version: '2026-07-29T00:00:00.000Z',
  permissions: { canManage: false },
};

function workItem(overrides: Partial<ProjectWorkItem> = {}): ProjectWorkItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    title: 'Review the measurements',
    responsibilityArea: 'DESIGN',
    status: 'OPEN',
    dueAt: '2026-07-30T05:00:00.000Z',
    slaBreachAt: null,
    deadlinePolicy: null,
    calendarRevision: null,
    assigneeUserId: null,
    effectiveAssignee: { kind: 'unassigned' },
    priority: 'NORMAL',
    priorityReason: null,
    blockedReason: null,
    origin: 'MANUAL',
    sourceType: 'MANUAL',
    sourceKey: null,
    seriesKey: null,
    subjectKind: null,
    subjectId: null,
    rowVersion: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
    outcome: null,
    cancellationReason: null,
    ...overrides,
  };
}

function projection(item = workItem()): ProjectWorkProjection {
  return {
    projectId: item.projectId,
    modelVersion: 2,
    operationalState: 'ACTIVE',
    effectiveState: 'ACTIVE',
    waitingUntil: null,
    waitingReason: null,
    closedOutcome: null,
    stateRowVersion: 1,
    primaryAction: { kind: 'workItem', item, dueState: 'today' },
    openItems: [item],
    blockedItems: [],
    confirmedFacts: [],
    generatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function changeInputValue(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!setter) throw new Error('Missing value setter');
  setter.call(target, value);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderCard(projectWork = projection(), stale = false, pipelineStage = 'new') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderIntoDocument(
    <QueryClientProvider client={client}>
      <ProjectWorkCommandCard
        projectId="proj_22222222-2222-4222-8222-222222222222"
        host="fixture"
        projectWork={projectWork}
        owner={owner}
        pipelineStage={pipelineStage}
        stale={stale}
        onRefresh={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectWorkCommandCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    runProjectWorkItemCommand.mockReset().mockResolvedValue({
      command: { id: 'command', committed: true, replayed: false, rowVersion: 2 },
    });
    runProjectConfirmationCommand.mockReset().mockResolvedValue({
      command: { id: 'command', committed: true, replayed: false, rowVersion: 2 },
    });
    runProjectStateCommand.mockReset();
    setProjectCommandOwner.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows one current manual action with state, owner, and a safe completion command', async () => {
    const rendered = renderCard();
    expect(rendered.container.textContent).toContain('Review the measurements');
    expect(rendered.container.textContent).toContain('Active');
    expect(rendered.container.textContent).toContain('Jordan');
    expect(rendered.container.textContent).toContain('1 open · 0 blocked');

    const complete = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Complete')!;
    await act(async () => { complete.click(); });

    expect(runProjectWorkItemCommand).toHaveBeenCalledWith(
      'proj_22222222-2222-4222-8222-222222222222',
      expect.objectContaining({
        command: 'COMPLETE',
        workItemId: '11111111-1111-4111-8111-111111111111',
        expectedRowVersion: 1,
      }),
    );
    rendered.unmount();
  });

  it('uses the semantic email confirmation instead of generic completion for lead cadence', async () => {
    const item = workItem({
      title: 'Send the first staff email',
      origin: 'AUTOMATION',
      sourceType: 'LEAD_CADENCE',
      sourceKey: 'lead:first-email:request-1',
    });
    const rendered = renderCard(projection(item));
    expect(rendered.container.textContent).not.toContain('Complete');

    const sent = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Email sent')!;
    await act(async () => { sent.click(); });

    expect(runProjectConfirmationCommand).toHaveBeenCalledWith(
      'proj_22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ command: 'RECORD_FIRST_ENQUIRY_EMAIL_SENT' }),
    );
    expect(runProjectWorkItemCommand).not.toHaveBeenCalled();
    rendered.unmount();
  });

  it('reuses the same command receipt when an email confirmation retry is ambiguous', async () => {
    const item = workItem({
      title: 'Send the first staff email',
      origin: 'AUTOMATION',
      sourceType: 'LEAD_CADENCE',
      sourceKey: 'lead:first-email:request-1',
    });
    runProjectConfirmationCommand
      .mockRejectedValueOnce(new Error('Connection lost after submit'))
      .mockResolvedValueOnce({
        command: { id: 'command', committed: true, replayed: true, rowVersion: 2 },
      });
    const rendered = renderCard(projection(item));
    const sent = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Email sent')!;

    await act(async () => { sent.click(); });
    await act(async () => { sent.click(); });

    expect(runProjectConfirmationCommand).toHaveBeenCalledTimes(2);
    const firstCommandId = runProjectConfirmationCommand.mock.calls[0]?.[1]?.commandId;
    const secondCommandId = runProjectConfirmationCommand.mock.calls[1]?.[1]?.commandId;
    expect(firstCommandId).toEqual(expect.any(String));
    expect(secondCommandId).toBe(firstCommandId);
    rendered.unmount();
  });

  it('atomically replaces a decision review when staff keep the project Active', async () => {
    const item = workItem({
      title: 'Decide whether to close this enquiry',
      origin: 'AUTOMATION',
      sourceType: 'LEAD_CADENCE',
      sourceKey: 'lead:close-review:22222222-2222-4222-8222-222222222222:v1',
      deadlinePolicy: 'LEAD_CLOSE_REVIEW_V1',
      rowVersion: 4,
    });
    const rendered = renderCard(projection(item));
    const manage = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Manage project work')!;
    await act(async () => { manage.click(); });

    const title = Array.from(rendered.container.querySelectorAll('input'))
      .find((input) => input.type === 'text')!;
    const due = rendered.container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    const reason = rendered.container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => {
      changeInputValue(reason, 'Customer asked us to continue with a revised concept');
      changeInputValue(title, 'Prepare revised concept');
      changeInputValue(due, '2026-08-04T17:00');
    });

    const replace = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Replace review with work')!;
    await act(async () => { replace.click(); });

    expect(runProjectWorkItemCommand).toHaveBeenCalledWith(
      'proj_22222222-2222-4222-8222-222222222222',
      expect.objectContaining({
        command: 'REPLACE_REVIEW',
        workItemId: item.id,
        expectedRowVersion: 4,
        reason: 'Customer asked us to continue with a revised concept',
        title: 'Prepare revised concept',
        responsibilityArea: 'CUSTOMER',
        dueAt: expect.any(String),
      }),
    );
    rendered.unmount();
  });

  it('shows an already confirmed manual site visit without another completion action', async () => {
    const projectWork = projection();
    projectWork.confirmedFacts = [{
      id: '33333333-3333-4333-8333-333333333333',
      type: 'SITE_VISIT_COMPLETED',
      subjectKind: 'PROJECT',
      subjectId: projectWork.projectId,
      occurredAt: '2026-07-29T04:00:00.000Z',
      recordedAt: '2026-07-29T04:00:00.000Z',
    }];
    const rendered = renderCard(projectWork, false, 'site_visit');
    const manage = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Manage project work')!;
    await act(async () => { manage.click(); });

    expect(rendered.container.textContent).toContain('Recorded complete');
    expect(Array.from(rendered.container.querySelectorAll('button'))
      .some((button) => button.textContent === 'Mark complete')).toBe(false);
    rendered.unmount();
  });

  it('pauses all mutation controls while the command-centre read is stale', () => {
    const rendered = renderCard(projection(), true);
    expect(rendered.container.textContent).toContain('Work controls paused');
    const complete = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Complete')!;
    expect(complete.disabled).toBe(true);
    rendered.unmount();
  });
});
