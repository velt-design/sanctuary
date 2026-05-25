'use client';

import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import railStyles from '../WorkbenchRail.module.css';

/*
 * PR-W3d.2 (2026-05-25) — single row inside the flat OBJECTS TREE.
 *
 * Reuses the existing rail button visual language (`objectButton`,
 * `objectButtonLabel`, `objectButtonMeta`, plus `buttonPrimary` /
 * `secondaryButton` for selected vs. unselected). The selection signal is
 * the primary-button styling; visibility-hidden state is communicated via
 * the subtitle text (e.g. "hidden in viewport") plus a data attribute so
 * tests can assert it.
 *
 * Pure presentational — no internal state, no async, no store reads. The
 * parent `<ObjectTreeSection>` builds the row data and dispatches selection.
 */

export type ObjectTreeRowProps = {
  family: WorkbenchObjectFamily;
  objectId: string | null;
  label: string;
  /**
   * Empty string when no descriptor and no state hint applies. Composed by
   * `subtitleForObjectTreeRow` in `lib/drawings/state/objectTreeRowSubtitles`.
   */
  subtitle: string;
  selected: boolean;
  /**
   * True when the family this row belongs to is hidden in the viewport.
   * Used as a data attribute for tests + future styling hooks; the visible
   * signal lives in the subtitle text ("hidden in viewport").
   */
  visibilityHidden: boolean;
  onSelect: (ref: WorkbenchObjectRef) => void;
};

export function ObjectTreeRow({
  family,
  objectId,
  label,
  subtitle,
  selected,
  visibilityHidden,
  onSelect,
}: ObjectTreeRowProps) {
  const className = `${selected ? railStyles.buttonPrimary : railStyles.secondaryButton} ${railStyles.objectButton}`;
  return (
    <button
      type="button"
      className={className}
      data-workbench-object-button={`${family}:${objectId ?? 'none'}`}
      data-tree-row-family={family}
      data-tree-row-selected={selected ? 'true' : 'false'}
      data-tree-row-visibility-hidden={visibilityHidden ? 'true' : 'false'}
      onClick={() => onSelect({ family, objectId })}
    >
      <span className={railStyles.objectButtonLabel}>{label}</span>
      {subtitle ? <span className={railStyles.objectButtonMeta}>{subtitle}</span> : null}
    </button>
  );
}
