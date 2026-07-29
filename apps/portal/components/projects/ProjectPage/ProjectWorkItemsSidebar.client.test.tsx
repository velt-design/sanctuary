import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectWorkItem,
  ProjectWorkProjection,
} from '@/lib/projects/workItems/types';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectWorkItemsSidebar from './ProjectWorkItemsSidebar.client';

const runProjectWorkItemCommand = vi.fn();
const runProjectConfirmationCommand = vi.fn();

vi.mock('@/lib/projects/workItems/client', () => ({
  runProjectWorkItemCommand: (...args: unknown[]) => runProjectWorkItemCommand(...args),
  runProjectConfirmationCommand: (...args: unknown[]) => runProjectConfirmationCommand(...args),
}));

const item: ProjectWorkItem = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  title: 'Send the first staff email',
  responsibilityArea: 'CUSTOMER',
  status: 'OPEN',
  dueAt: '2026-07-30T05:00:00.000Z',
  slaBreachAt: null,
  deadlinePolicy: 'FIRST_ENQUIRY_EMAIL_V1',
  calendarRevision: 'v1',
  assigneeUserId: null,
  effectiveAssignee: { kind: 'unassigned' },
  priority: 'NORMAL',
  priorityReason: null,
  blockedReason: null,
  origin: 'AUTOMATION',
  sourceType: 'LEAD_CADENCE',
  sourceKey: 'lead:first-email:request-1',
  seriesKey: 'lead:request-1',
  subjectKind: 'PROJECT',
  subjectId: '22222222-2222-4222-8222-222222222222',
  rowVersion: 1,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  outcome: null,
  cancellationReason: null,
};

const projection: ProjectWorkProjection = {
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

function renderSidebar(stale: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderIntoDocument(
    <QueryClientProvider client={client}>
      <ProjectWorkItemsSidebar
        projectId="proj_22222222-2222-4222-8222-222222222222"
        projectWork={projection}
        host="host"
        stale={stale}
      />
    </QueryClientProvider>,
  );
}

describe('ProjectWorkItemsSidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    runProjectWorkItemCommand.mockReset();
    runProjectConfirmationCommand.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps stale V2 work visible but pauses every mutation', async () => {
    const rendered = renderSidebar(true);
    expect(rendered.container.textContent).toContain('Send the first staff email');
    expect(rendered.container.textContent).toContain('Work controls paused');
    const sent = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Email sent')!;
    const replied = Array.from(rendered.container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Customer replied')!;

    expect(sent.disabled).toBe(true);
    expect(replied.disabled).toBe(true);
    await act(async () => {
      sent.click();
      replied.click();
    });
    expect(runProjectConfirmationCommand).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
