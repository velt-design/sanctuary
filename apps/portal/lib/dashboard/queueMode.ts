import type { QueueMode } from './types';

export function parseDashboardQueueMode(value: string | null | undefined): QueueMode {
  if (value === 'next7' || value === 'alldue') return value;
  return 'today';
}
