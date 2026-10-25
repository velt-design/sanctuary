'use client';
import type {ReactNode} from 'react';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { SearchFilterBar } from '@/components/ui/foundation/SearchFilterBar';
import type {WorkQueueFilters} from './workQueueFilterSelection';
import styles from './PaginatedProjectWorkQueueList.module.css';
import queueStyles from './ProjectWorkQueue.module.css';
export type WorkQueueSurfaceProps={filters:WorkQueueFilters;setFilter:<K extends keyof WorkQueueFilters>(key:K,value:WorkQueueFilters[K])=>void;
  clearFilters:()=>void;ownerOptions:Array<{value:string;label:string}>;stageOptions:Array<{value:string;label:string}>;content:ReactNode;pagination?:ReactNode};
export default function WorkQueueSurface({filters,setFilter,clearFilters,ownerOptions,stageOptions,content,pagination}:WorkQueueSurfaceProps){
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
      <div className={queueStyles.groups}>{content}</div>
      {pagination}
    </div>
  );
}
