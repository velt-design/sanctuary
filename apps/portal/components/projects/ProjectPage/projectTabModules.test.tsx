import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { JobPacksTab } from './projectTabModules';

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options: { loading: ComponentType }) => options.loading,
}));

describe('project tab dynamic pending frames', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    searchParams = new URLSearchParams();
  });

  it('keeps the Job Packs list structure mounted while the tab chunk loads', () => {
    const rendered = renderIntoDocument(<JobPacksTab projectId="proj_1" />);

    expect(rendered.container.querySelector('[data-portal-page-shell="project-job-packs"]')).not.toBeNull();
    expect(rendered.container.querySelector('table[aria-label="Job packs"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-tab-loading]')).toBeNull();
    rendered.unmount();
  });

  it('keeps the selected workbook and sheet structure mounted while the tab chunk loads', () => {
    searchParams = new URLSearchParams('estimateId=est_1&sheet=labour');

    const rendered = renderIntoDocument(<JobPacksTab projectId="proj_1" />);

    expect(rendered.container.querySelector('[data-portal-page-shell="project-job-pack-detail"]')).not.toBeNull();
    expect(rendered.container.querySelector<HTMLSelectElement>('[aria-label="Job pack sheet"]')?.value).toBe('labour');
    expect(rendered.container.querySelector('[data-portal-page-region="spreadsheet-grid"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-project-tab-loading]')).toBeNull();
    rendered.unmount();
  });

  it('keeps the exact Job Packs list frame mounted while list data loads', () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        'apps/portal/components/projects/ProjectPage/tabs/JobPacksTab.tsx',
      ),
      'utf8',
    );

    expect(source).toContain('if (jobPacksQuery.isLoading)');
    expect(source).toContain('return <JobPacksPendingFrame />;');
    expect(source).not.toContain('LoadingSkeleton');
  });
});
