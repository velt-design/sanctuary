import type { ProjectPageSnapshotResponse } from './types';
import type { ProjectCommandCentreResponse } from './commandCentre/types';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';

export type ProjectWorkInitialData = {
  summary: ProjectPageSnapshotResponse;
  snapshot: ProjectPageSnapshotResponse;
  command: ProjectCommandCentreResponse;
  payment: ProjectInvoiceSchedule;
};
export type ProjectWorkReadResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };
export type ProjectWorkInitialRead = {
  id: string;
  ownerId: string;
  host: string;
  projectId: string;
  results: { [K in keyof ProjectWorkInitialData]: Promise<ProjectWorkReadResult<ProjectWorkInitialData[K]>> };
};

/** Optional scoped readers for fictional, read-only UI proof; production uses the existing API adapters. */
export type ProjectWorkReadLoaders = { [K in keyof ProjectWorkInitialData]: (projectId: string) => Promise<ProjectWorkInitialData[K]> };
