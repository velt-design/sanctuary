'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, DataStatePanel, Pagination, SearchFilterBar } from '@/components/ui/foundation';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import ProjectWorkQueueList from './ProjectWorkQueueList';
import type { WorkQueueEntryView } from './workQueuePresentation';
import { clampWorkQueuePage, paginateWorkQueueEntries } from './workQueuePagination';
import {
  DEFAULT_WORK_QUEUE_FILTERS,
  filterWorkQueueEntries,
  workQueueOwnerOptions,
  workQueueStageOptions,
  type WorkQueueFilters,
} from './workQueueFilters';
import styles from './PaginatedProjectWorkQueueList.module.css';

export default function PaginatedProjectWorkQueueList({
  entries,
  staff,
  host,
  mutationsEnabled = true,
  reassignmentEnabled = true,
}: {
  entries: WorkQueueEntryView[];
  staff: ProjectCommandStaffSummary[];
  host: string;
  mutationsEnabled?: boolean;
  reassignmentEnabled?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<WorkQueueFilters>(DEFAULT_WORK_QUEUE_FILTERS);
  const filteredEntries = useMemo(
    () => filterWorkQueueEntries(entries, staff, filters),
    [entries, filters, staff],
  );
  const ownerOptions = useMemo(() => workQueueOwnerOptions(entries, staff), [entries, staff]);
  const stageOptions = useMemo(() => workQueueStageOptions(entries), [entries]);
  const visible = useMemo(
    () => paginateWorkQueueEntries(filteredEntries, page),
    [filteredEntries, page],
  );

  useEffect(() => {
    const nextPage = clampWorkQueuePage(page, filteredEntries.length);
    if (nextPage !== page) setPage(nextPage);
  }, [filteredEntries.length, page]);

  const setFilter = <Key extends keyof WorkQueueFilters>(
    key: Key,
    value: WorkQueueFilters[Key],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const hasFilters = Boolean(
    filters.query.trim()
    || filters.owner !== 'all'
    || filters.stage !== 'all'
    || filters.dueGroup !== 'all',
  );
  const clearFilters = () => {
    setFilters(DEFAULT_WORK_QUEUE_FILTERS);
    setPage(1);
  };

  return (
    <div className={styles.wrapper}>
      <Card title="Find work" padding="compact" aria-label="Work Queue filters">
        <SearchFilterBar
          query={filters.query}
          onQueryChange={(value) => setFilter('query', value)}
          queryPlaceholder="Project, action, reason or owner…"
          searchId="workQueueSearch"
          collapseFiltersOnNarrow
          filters={[
            { id: 'workQueueOwner', label: 'Owner', value: filters.owner, onChange: (value) => setFilter('owner', value), options: ownerOptions },
            { id: 'workQueueStage', label: 'Stage', value: filters.stage, onChange: (value) => setFilter('stage', value), options: stageOptions },
            {
              id: 'workQueueDue',
              label: 'When',
              value: filters.dueGroup,
              onChange: (value) => setFilter('dueGroup', value as WorkQueueFilters['dueGroup']),
              options: [
                { value: 'all', label: 'Any time' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'today', label: 'Today / ready now' },
                { value: 'nextSevenBusinessDays', label: 'Next 7 business days' },
                { value: 'blocked', label: 'Blocked' },
                { value: 'needsTriage', label: 'Needs triage' },
              ],
            },
          ]}
          onClearAll={clearFilters}
        />
      </Card>

      {hasFilters && !filteredEntries.length ? (
        <DataStatePanel state="filtered-empty" onClear={clearFilters} />
      ) : (
        <ProjectWorkQueueList
          entries={visible.entries}
          staff={staff}
          host={host}
          mutationsEnabled={mutationsEnabled}
          reassignmentEnabled={reassignmentEnabled}
        />
      )}
      {filteredEntries.length ? (
        <div className={styles.pagination}>
          <Pagination
            currentPage={visible.page}
            totalPages={visible.totalPages}
            itemSummary={`${visible.rangeStart}–${visible.rangeEnd} of ${filteredEntries.length} projects${hasFilters ? ` (${entries.length} total)` : ''}`}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
