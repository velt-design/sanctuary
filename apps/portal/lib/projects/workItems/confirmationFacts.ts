import type { ProjectConfirmationType } from './types';

type ConfirmationEventIdentity = {
  id?: unknown;
  project_id?: unknown;
  event_kind?: unknown;
  confirmation_type?: unknown;
  retracts_event_id?: unknown;
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function activeConfirmationEventRows<T extends ConfirmationEventIdentity>(rows: readonly T[]): T[] {
  const retractedIds = new Set(
    rows
      .filter((row) => text(row.event_kind) === 'RETRACTED')
      .map((row) => text(row.retracts_event_id))
      .filter((id): id is string => id !== null),
  );
  return rows.filter((row) => text(row.event_kind) === 'CONFIRMED' && !retractedIds.has(text(row.id) ?? ''));
}

export function hasActiveProjectConfirmation(
  rows: readonly ConfirmationEventIdentity[],
  projectUuid: string,
  type: ProjectConfirmationType,
): boolean {
  return activeConfirmationEventRows(rows).some(
    (row) => text(row.project_id) === projectUuid && text(row.confirmation_type) === type,
  );
}

/** Index one portfolio read once, retaining the same append-only retraction rules. */
export function activeConfirmationProjectIds(
  rows: readonly ConfirmationEventIdentity[],
  type: ProjectConfirmationType,
): ReadonlySet<string> {
  const projectIds = new Set<string>();
  for (const row of activeConfirmationEventRows(rows)) {
    const projectId = text(row.project_id);
    if (projectId && text(row.confirmation_type) === type) projectIds.add(projectId);
  }
  return projectIds;
}
