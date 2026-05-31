import type { DrawingWorkbenchRailObjectEntry } from './drawingWorkbenchRailModel';
import type { DrawingWorkbenchVisibilityState } from './drawingWorkbenchUiState';
import type { WorkbenchObjectFamily } from './objectFirstWorkbenchModel';

/*
 * PR-W3d.1 (2026-05-25) — pure subtitle derivation for the flat OBJECTS TREE.
 *
 * The CAD-style left rail renders each object as a row with `label` on the
 * first line and a concise subtitle on the second. The subtitle combines a
 * family-specific descriptor (e.g. "Mono", "Footprint ready") with a
 * state hint (e.g. "selected", "hidden in viewport", "approximate").
 *
 * These are pure functions over the existing rail-model + UI-state shapes —
 * no new store fields, no React. The flat tree in PR-W3d.3 consumes them
 * via `<ObjectTreeRow>` (PR-W3d.2).
 *
 * Mockup reference: every row shows e.g. "Pergola 1 / Mono · acrylic · selected".
 * The "acrylic" enrichment (roof material) requires extra plumbing from
 * `solvedProject.pergolas[].moduleInput` and is deferred to a follow-up;
 * this PR ships the descriptor + state-hint composition using only data
 * already present in `DrawingWorkbenchRailObjectEntry.meta`.
 */

export type ObjectTreeRowSubtitleInput = {
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
 * intentional (vs. a missing-data bug).
 */
export function emptyStateForFamily(family: WorkbenchObjectFamily): ObjectTreeFamilyEmptyState {
  return FAMILY_EMPTY_STATES[family];
}

/**
 * Compose an object-tree row's subtitle from the existing rail entry plus
 * visibility and selection flags. Returns an empty string when neither a
 * descriptor nor a hint is available (caller renders the row without a
 * subtitle line).
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
 * Extract the primary descriptor from a rail-entry meta string. The rail
 * model builds meta as a pipe-delimited summary (e.g. "Mono | Rear edge",
 * "Footprint ready | mono roof | 0 warnings"). The CAD outliner only
 * needs the first segment for the always-visible subtitle; deeper details
 * surface in the right inspector when the row is selected.
 */
export function primaryDescriptorFromMeta(meta: string | null): string {
  if (!meta) return '';
  const trimmed = meta.split('|')[0]?.trim();
  return trimmed ?? '';
}

/**
 * State hint hierarchy (highest priority wins):
 *   1. `selected` → "selected"
 *   2. family hidden in viewport → "hidden in viewport"
 *   3. trust state is not geometry_ready → the trust label lowercased
 *   4. otherwise → empty string (no hint suffix)
 *
 * Encodes the user-facing prioritisation: selection is the most important
 * signal at-a-glance; visibility is next (it explains why the canvas looks
 * empty even though the navigator has rows); trust comes last so the user
 * notices broken/approximate objects without it being noisy on the happy
 * path.
 */
export function stateHintForRow(input: ObjectTreeRowSubtitleInput): string {
  if (input.selected) return 'selected';
  if (!input.familyVisible) return 'hidden in viewport';
  if (input.entry.trustStatus !== 'geometry_ready') {
    return input.entry.trustLabel.toLowerCase();
  }
  return '';
}

/**
 * Convenience: derive `familyVisible` from the workbench's family-level
 * visibility state. The rail model carries family ids; the visibility
 * state keys are `'house'` (singular) for house forms and the family id
 * otherwise — this helper hides that asymmetry from callers.
 */
export function familyVisibilityFor(
  family: WorkbenchObjectFamily,
  visibility: DrawingWorkbenchVisibilityState,
): boolean {
  if (family === 'house_forms') return visibility.house;
  return visibility[family];
}
