'use client';

import { useEffect, useLayoutEffect, useMemo, useState,type ReactNode } from 'react';
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
import WorkQueueSurface from './WorkQueueSurface';
import {useWorkQueueWorkspace} from '@/app/staff/projects/work-queue/WorkQueueWorkspace';

export default function PaginatedProjectWorkQueueList({
  entries,
  staff,
  host,
  mutationsEnabled = true,
  reassignmentEnabled = true,pending=false,statusPanel,
}: {
  entries: WorkQueueEntryView[];
  staff: ProjectCommandStaffSummary[];
  host: string;
  mutationsEnabled?: boolean;
  reassignmentEnabled?: boolean;pending?:boolean;statusPanel?:ReactNode;
}) {
  const workspace=useWorkQueueWorkspace();
  const [localPage,setLocalPage]=useState(1);
  const page=workspace?.page??localPage;
  const setPage=workspace?.setPage??setLocalPage;
  const [localFilters,setLocalFilters]=useState<WorkQueueFilters>(DEFAULT_WORK_QUEUE_FILTERS);
  const filters=workspace?.filters??localFilters;
  const setFilters=workspace?.setFilters??setLocalFilters;
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

  const surface={filters,setFilter,clearFilters,ownerOptions,stageOptions,
    content:(statusPanel??(pending?<ProjectWorkQueueList contentsOnly pending entries={[]} staff={staff} host={host} mutationsEnabled={false}/>:hasFilters && !filteredEntries.length ? (
        <DataStatePanel state="filtered-empty" onClear={clearFilters} />
      ) : (
        <ProjectWorkQueueList contentsOnly
          entries={visible.entries}
          staff={staff}
          host={host}
          mutationsEnabled={mutationsEnabled}
          reassignmentEnabled={reassignmentEnabled}
        />
      ))),pagination:<>{!pending&&!statusPanel&&filteredEntries.length ? (
        <div className={styles.pagination}>
          <Pagination
            currentPage={visible.page}
            totalPages={visible.totalPages}
            itemSummary={`${visible.rangeStart}–${visible.rangeEnd} of ${filteredEntries.length} projects${hasFilters ? ` (${entries.length} total)` : ''}`}
            onPageChange={setPage}
          />
        </div>
      ) : null}</>};
  useLayoutEffect(()=>{workspace?.publishList(surface);});
  useLayoutEffect(()=>()=>workspace?.publishList(null),[workspace?.publishList]);
  return workspace?null:<WorkQueueSurface {...surface}/>;
}
