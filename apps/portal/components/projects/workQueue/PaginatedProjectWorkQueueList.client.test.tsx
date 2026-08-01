import { act, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { WorkQueueEntryView } from './workQueuePresentation';
import PaginatedProjectWorkQueueList from './PaginatedProjectWorkQueueList.client';

vi.mock('./ProjectWorkQueueList', () => ({
  default: ({
    entries,
    mutationsEnabled,
  }: {
    entries: WorkQueueEntryView[];
    mutationsEnabled: boolean;
  }) => (
    <div
      data-testid="visible-work"
      data-first-project={entries[0]?.projectId}
      data-last-project={entries.at(-1)?.projectId}
      data-count={entries.length}
      data-mutations-enabled={String(mutationsEnabled)}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

function entries(count: number): WorkQueueEntryView[] {
  return Array.from({ length: count }, (_, index) => ({
    projectId: `proj_${index + 1}`,
    projectName: `Project ${index + 1}`,
    stage: 'contacted',
    group: 'today',
    actionKind: 'workItem',
    title: 'Follow up',
    reason: 'Customer follow-up is due.',
    dueAt: '2026-07-31T00:00:00.000Z',
    priority: null,
    blockedReason: null,
    effectiveAssignee: { kind: 'unassigned' },
    workItemId: null,
    workItemRowVersion: null,
    stateRowVersion: 1,
    sourceType: null,
    sourceKey: null,
    subjectKind: null,
    subjectId: null,
    href: `/staff/projects/proj_${index + 1}`,
  })) as WorkQueueEntryView[];
}

describe('PaginatedProjectWorkQueueList', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the full queue reachable in bounded accessible pages', () => {
    const rendered = renderIntoDocument(
      <PaginatedProjectWorkQueueList
        entries={entries(205)}
        staff={[]}
        host="host"
        mutationsEnabled={false}
      />,
    );

    let visible = rendered.container.querySelector('[data-testid="visible-work"]');
    expect(visible?.getAttribute('data-first-project')).toBe('proj_1');
    expect(visible?.getAttribute('data-last-project')).toBe('proj_100');
    expect(visible?.getAttribute('data-count')).toBe('100');
    expect(visible?.getAttribute('data-mutations-enabled')).toBe('false');
    expect(rendered.container.querySelector('nav[aria-label="Pagination"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('1–100 of 205 projects');

    const next = rendered.container.querySelector(
      'button[aria-label="Next page"]',
    ) as HTMLButtonElement;
    act(() => next.click());

    visible = rendered.container.querySelector('[data-testid="visible-work"]');
    expect(visible?.getAttribute('data-first-project')).toBe('proj_101');
    expect(visible?.getAttribute('data-last-project')).toBe('proj_200');
    expect(rendered.container.textContent).toContain('101–200 of 205 projects');

    rendered.unmount();
  });
});
