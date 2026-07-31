'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pagination } from '@/components/ui/foundation';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import ProjectWorkQueueList from './ProjectWorkQueueList';
import type { WorkQueueEntryView } from './workQueuePresentation';
import {
  clampWorkQueuePage,
  paginateWorkQueueEntries,
} from './workQueuePagination';
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
  const visible = useMemo(
    () => paginateWorkQueueEntries(entries, page),
    [entries, page],
  );

  useEffect(() => {
    const nextPage = clampWorkQueuePage(page, entries.length);
    if (nextPage !== page) setPage(nextPage);
  }, [entries.length, page]);

  return (
    <div className={styles.wrapper}>
      <ProjectWorkQueueList
        entries={visible.entries}
        staff={staff}
        host={host}
        mutationsEnabled={mutationsEnabled}
        reassignmentEnabled={reassignmentEnabled}
      />
      {entries.length ? (
        <div className={styles.pagination}>
          <Pagination
            currentPage={visible.page}
            totalPages={visible.totalPages}
            itemSummary={`${visible.rangeStart}–${visible.rangeEnd} of ${entries.length} projects`}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
