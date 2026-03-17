import type {
  DesignListEditableCellKey,
  DesignListRow,
  DesignPackagesResponse,
  DesignRequestPriorityTier,
  DesignRequestStatus,
} from './types';

export type NormalizedDesignListCellValue = string | DesignRequestPriorityTier | DesignRequestStatus | null;

export type DesignListCellEditability = {
  editable: boolean;
  reason?: string;
};

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeDesignListCellInput(
  key: DesignListEditableCellKey,
  value: unknown,
): { ok: true; value: NormalizedDesignListCellValue } | { ok: false; error: string } {
  switch (key) {
    case 'notes':
      return { ok: true, value: typeof value === 'string' ? value.trim() : '' };
    case 'design_ready': {
      const next = typeof value === 'string' ? value.trim().toUpperCase() : '';
      if (next === 'OPEN' || next === 'IN_PROGRESS' || next === 'DONE' || next === 'CANCELLED' || next === 'BLOCKED') {
        return { ok: true, value: next };
      }
      return { ok: false, error: 'Design ready must be OPEN, IN_PROGRESS, BLOCKED, DONE, or CANCELLED.' };
    }
    case 'priority': {
      const next = typeof value === 'string' ? value.trim().toUpperCase() : '';
      if (next === 'TIER_1' || next === 'TIER_2' || next === 'TIER_3' || next === 'TIER_4' || next === 'UNPRICED') {
        return { ok: true, value: next };
      }
      return { ok: false, error: 'Priority must be TIER_1, TIER_2, TIER_3, TIER_4, or UNPRICED.' };
    }
    default: {
      const exhaustive: never = key;
      return { ok: false, error: `Unsupported cell ${exhaustive}` };
    }
  }
}

export function getDesignListCellEditability(row: DesignListRow, key: DesignListEditableCellKey): DesignListCellEditability {
  if (key === 'priority') return { editable: true };
  if (key === 'notes') return { editable: true };
  if (row.status === 'DONE' || row.status === 'CANCELLED') {
    return { editable: false, reason: 'Completed requests are read-only.' };
  }
  return { editable: true };
}

export function getDesignListEditorValue(row: DesignListRow, key: DesignListEditableCellKey): NormalizedDesignListCellValue {
  switch (key) {
    case 'design_ready':
      return row.status;
    case 'priority':
      return row.priorityTier;
    case 'notes':
      return row.notes;
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function rowVersionFromParts(parts: Array<string | null>): string {
  return parts.map((part) => part ?? '').join('|');
}

export function applyOptimisticDesignListCellValue(
  row: DesignListRow,
  key: DesignListEditableCellKey,
  value: NormalizedDesignListCellValue,
  _lookups: DesignPackagesResponse['lookups'],
): DesignListRow {
  const nowIso = new Date().toISOString();
  const next: DesignListRow = {
    ...row,
    updatedAt: nowIso,
  };

  if (key === 'notes') {
    next.notes = typeof value === 'string' ? value : '';
    next.designerNote = next.notes || null;
  }

  if (key === 'priority' && typeof value === 'string') {
    next.priorityTier = value as DesignRequestPriorityTier;
  }

  if (key === 'design_ready' && typeof value === 'string') {
    const nextStatus = value as DesignRequestStatus;
    next.status = nextStatus;
    if (nextStatus === 'IN_PROGRESS' && !next.startedAt) next.startedAt = nowIso;
    if (nextStatus === 'DONE') {
      next.startedAt = next.startedAt ?? nowIso;
      next.completedAt = nowIso;
      next.cancelledAt = null;
    } else if (nextStatus === 'CANCELLED') {
      next.cancelledAt = nowIso;
    } else if (nextStatus === 'OPEN') {
      next.completedAt = null;
      next.cancelledAt = null;
    }
  }

  next.rowVersion = rowVersionFromParts([next.updatedAt, next.sentAt, next.visitStatus, next.visitCompletedAt, next.notes, next.status, next.priorityTier]);
  return next;
}
