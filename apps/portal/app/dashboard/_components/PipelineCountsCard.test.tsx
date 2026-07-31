import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PipelineCountsCard from './PipelineCountsCard';

vi.mock('@/components/navigation/ProjectsIndexLink', () => ({
  default: ({
    children,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

describe('PipelineCountsCard', () => {
  it('reduces detailed stages into five journeys and presents server-owned states', () => {
    const markup = renderToStaticMarkup(
      <PipelineCountsCard
        counts={{
          NEW: 2,
          CONTACTED: 3,
          SITE_VISIT: 4,
          QUOTING: 5,
          SENT: 6,
          DEPOSIT: 7,
          SCHEDULED: 8,
          COMPLETED: 9,
          PAID: 10,
        }}
        stateCounts={{
          ACTIVE: 31,
          WAITING: 4,
          CLOSED: 12,
          ARCHIVED: 2,
          totalCount: 49,
        }}
      />,
    );

    expect(markup).toContain('Project portfolio');
    expect(markup).toContain('href="/staff/projects?journey=ENQUIRY"');
    expect(markup).toMatch(/Enquiry<\/span><span[^>]*>5</);
    expect(markup).toMatch(/Proposal<\/span><span[^>]*>15</);
    expect(markup).toMatch(/Confirmed<\/span><span[^>]*>7</);
    expect(markup).toMatch(/Delivery<\/span><span[^>]*>17</);
    expect(markup).toMatch(/Settled<\/span><span[^>]*>10</);
    expect(markup).toContain('href="/staff/projects?state=WAITING"');
    expect(markup).toMatch(/Waiting<\/span><strong>4</);
    expect(markup).toMatch(/Closed<\/span><strong>12</);
  });

  it('labels operational counts unavailable instead of inventing values', () => {
    const markup = renderToStaticMarkup(
      <PipelineCountsCard
        counts={{ NEW: 1 }}
        stateCountsAvailable={false}
      />,
    );

    expect(markup).toContain('data-project-state-counts="unavailable"');
    expect(markup).toMatch(/Active<\/span><strong>—</);
  });
});
