import type {WorkQueueEntryView} from './workQueuePresentation';
export type WorkQueueFilters = {
  query: string;
  owner: string;
  stage: string;
  dueGroup: WorkQueueEntryView['group'] | 'all';
};

export const DEFAULT_WORK_QUEUE_FILTERS: WorkQueueFilters = {
  query: '',
  owner: 'all',
  stage: 'all',
  dueGroup: 'all',
};
