'use client';

import ProjectsIndexFrame from '@/app/staff/projects/ProjectsIndexFrame';
import { ProjectsIndexPendingTable } from '@/app/staff/projects/ProjectsIndexTableHeader';
import {
  PROJECT_JOURNEY_FILTER_OPTIONS,
  PROJECT_STAGE_FILTER_OPTIONS,
  PROJECT_STATE_FILTER_OPTIONS,
  parseProjectsIndexFilters,
} from '@/app/staff/projects/projectIndexFilters';
import { PROJECTS_INDEX_OWNER_OPTIONS } from '@/lib/projects/projectsIndexContract';
import { SearchFilterBar } from '@/components/ui/foundation';

const noop = () => {};

type PendingSearchParams = Pick<URLSearchParams, 'toString'>;

export default function ProjectsIndexPendingFrame({
  searchParams,
}: {
  searchParams?: PendingSearchParams | null;
}) {
  const filters = parseProjectsIndexFilters(
    new URLSearchParams(searchParams?.toString() ?? ''),
  );

  return (
    <ProjectsIndexFrame
      state="pending"
      backgroundReady={false}
      totalCount={null}
      visibleCount={0}
      rangeLabel={<span data-portal-value-slot="loading">Updating…</span>}
      filters={
        <SearchFilterBar
          query={filters.query}
          onQueryChange={noop}
          searchId="projectSearch"
          queryPlaceholder="Name, client, phone or address…"
          collapseFiltersOnNarrow
          disabled
          filters={[
            {
              id: 'projectJourneyFilter',
              label: 'Journey',
              value: filters.journeyFilter,
              onChange: noop,
              options: [...PROJECT_JOURNEY_FILTER_OPTIONS],
            },
            {
              id: 'projectStageFilter',
              label: 'Stage',
              value: filters.stageFilter,
              onChange: noop,
              options: [...PROJECT_STAGE_FILTER_OPTIONS],
            },
            {
              id: 'projectStateFilter',
              label: 'State',
              value: filters.stateFilter,
              onChange: noop,
              options: [...PROJECT_STATE_FILTER_OPTIONS],
            },
            {
              id: 'projectOwnerFilter',
              label: 'Owner',
              value: filters.ownerFilter,
              onChange: noop,
              options: [...PROJECTS_INDEX_OWNER_OPTIONS],
            },
            {
              id: 'projectSort',
              label: 'Sort',
              value: 'newest',
              onChange: noop,
              options: [
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
                { value: 'name_asc', label: 'Name A–Z' },
                { value: 'name_desc', label: 'Name Z–A' },
              ],
            },
            {
              id: 'projectPageSize',
              label: 'Rows',
              value: '50',
              onChange: noop,
              options: [
                { value: '50', label: '50 rows' },
                { value: '25', label: '25 rows' },
                { value: '100', label: '100 rows' },
              ],
            },
          ]}
          onClearAll={noop}
        />
      }
      list={<ProjectsIndexPendingTable />}
    />
  );
}
