import type { DrawingWorkbenchRailObjectEntry } from './drawingWorkbenchRailModel';
import type { DrawingWorkbenchVisibilityState } from './drawingWorkbenchUiState';
import type { WorkbenchObjectFamily } from './objectFirstWorkbenchModel';

/*
 * Pure subtitle and empty-state helpers for the workbench object tree.
 *
 * The left rail renders each object as a label plus a short subtitle. These
 * helpers combine the rail entry's descriptor with selection, visibility, and
 * trust hints without adding store fields or React state.
 */

type ObjectTreeRowSubtitleInput = {
  entry: DrawingWorkbenchRailObjectEntry;
  /** True when this row is the workbench's active selection. */
  selected: boolean;
  /**
   * True when the family this row belongs to is set to visible in the
   * viewport. When false, the row appends "hidden in viewport" so the user
   * can see at a glance which objects are dropped from the canvas without
   * being removed from the navigator.
   */
  familyVisible: boolean;
};

export type ObjectTreeFamilyEmptyState = {
  /** Headline shown when a family section has zero objects (e.g. "No openings"). */
  message: string;
  /** Optional faint helper hint (e.g. "Add from inspector"). */
  hint: string | null;
};

const FAMILY_EMPTY_STATES: Record<WorkbenchObjectFamily, ObjectTreeFamilyEmptyState> = {
  house_forms: {
    message: 'No house forms',
    hint: 'Add structure from inspector',
  },
  pergolas: {
    message: 'No pergolas',
    hint: 'Drag and snap from the toolbar',
  },
  decks: {
    message: 'No decks',
    hint: 'Add from inspector',
  },
  openings: {
    message: 'No openings',
    hint: 'Add from inspector',
  },
};

/**
 * Standardised empty-state copy for a family section. Each family has its
 * own headline + optional helper hint so the empty rail still reads as
 * intentional, not as missing data.
 */
export function emptyStateForFamily(family: WorkbenchObjectFamily): ObjectTreeFamilyEmptyState {
  return FAMILY_EMPTY_STATES[family];
}

/**
 * Compose an object-tree row's subtitle from the existing rail entry plus
 * visibility and selection flags. Returns an empty string when neither a
 * descriptor nor a hint is available.
 *
 * Format: `{descriptor} · {hint}` where either side may be omitted.
 */
export function subtitleForObjectTreeRow(input: ObjectTreeRowSubtitleInput): string {
  const descriptor = primaryDescriptorFromMeta(input.entry.meta);
  const hint = stateHintForRow(input);
  if (!descriptor && !hint) return '';
  if (!descriptor) return hint;
  if (!hint) return descriptor;
  return `${descriptor} · ${hint}`;
}

/**
 * Extract the primary descriptor from a pipe-delimited rail-entry meta string.
 * The right inspector owns deeper detail when the row is selected.
 */
function primaryDescriptorFromMeta(meta: string | null): string {
  if (!meta) return '';
  const trimmed = meta.split('|')[0]?.trim();
  return trimmed ?? '';
}

/**
 * State hint hierarchy:
 *   1. selected
 *   2. hidden in viewport
 *   3. non-ready trust label
 *   4. empty string
 */
function stateHintForRow(input: ObjectTreeRowSubtitleInput): string {
  if (input.selected) return 'selected';
  if (!input.familyVisible) return 'hidden in viewport';
  if (input.entry.trustStatus !== 'geometry_ready') {
    return input.entry.trustLabel.toLowerCase();
  }
  return '';
}

/**
 * The visibility state uses `house` for the `house_forms` family and the
 * family id for the others.
 */
export function familyVisibilityFor(
  family: WorkbenchObjectFamily,
  visibility: DrawingWorkbenchVisibilityState,
): boolean {
  if (family === 'house_forms') return visibility.house;
  return visibility[family];
}
