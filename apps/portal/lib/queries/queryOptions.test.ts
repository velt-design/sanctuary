import { describe, expect, it } from 'vitest';
import { contactsListQueryOptions } from './contacts';
import { dashboardDataQueryOptions } from './dashboard';
import { estimateMetasByProjectQueryOptions } from './projectEstimates';
import { projectPageSnapshotQueryOptions, projectsListQueryOptions } from './projects';
import { quoteVersionDetailQueryOptions, quoteVersionsByProjectQueryOptions } from './quotes';

describe('query option budgets', () => {
  it('applies explicit stale and gc times to contact and project reads', () => {
    expect(contactsListQueryOptions('host').staleTime).toBe(1000 * 60 * 30);
    expect(contactsListQueryOptions('host').gcTime).toBe(1000 * 60 * 60 * 24);

    expect(projectsListQueryOptions('host').staleTime).toBe(1000 * 60 * 30);
    expect(projectsListQueryOptions('host').gcTime).toBe(1000 * 60 * 60 * 24);
  });

  it('applies project-shell and quote/estimate budgets', () => {
    expect(projectPageSnapshotQueryOptions('host', 'proj_1').staleTime).toBe(1000 * 60 * 5);
    expect(projectPageSnapshotQueryOptions('host', 'proj_1').gcTime).toBe(1000 * 60 * 60 * 24);

    expect(estimateMetasByProjectQueryOptions('host', 'proj_1').staleTime).toBe(1000 * 60 * 10);
    expect(quoteVersionsByProjectQueryOptions('host', 'proj_1').staleTime).toBe(1000 * 60 * 10);
    expect(quoteVersionDetailQueryOptions('host', 'qv_1').staleTime).toBe(1000 * 60 * 10);
  });

  it('keeps dashboard on a short explicit budget', () => {
    expect(dashboardDataQueryOptions('today').staleTime).toBe(1000 * 60);
    expect(dashboardDataQueryOptions('today').gcTime).toBe(1000 * 60 * 60 * 24);
  });
});
