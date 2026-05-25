'use client';

import type { ObjectTreeFamilyEmptyState } from '@/lib/drawings/state/objectTreeRowSubtitles';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { ObjectTreeRow, type ObjectTreeRowProps } from './ObjectTreeRow';
import railStyles from '../WorkbenchRail.module.css';
import sectionStyles from './ObjectTreeSection.module.css';

/*
 * PR-W3d.2 (2026-05-25) — one family heading + always-visible row list +
 * optional inline add affordance + standardised empty-state copy.
 *
 * Renders inside the flat OBJECTS TREE that replaces the Object Navigator
 * tab strip in PR-W3d.3. Every family section renders simultaneously — the
 * user never has to switch tabs to see another family's objects. Selection
 * happens via row click, not section click.
 *
 * Pure presentational. The parent (`ObjectWorkbenchRail` in PR-W3d.3)
 * computes per-row props from `model.objectLists[family]` + the subtitle
 * helpers and supplies them via the `rows` prop.
 */

type ObjectTreeRowData = Omit<ObjectTreeRowProps, 'onSelect' | 'family'> & {
  /** Per-row family inferred from section context, exposed for tests/data hooks. */
};

export type ObjectTreeSectionProps = {
  family: WorkbenchObjectFamily;
  /** Section header label (e.g. "House Forms", "Pergolas"). */
  label: string;
  rows: ObjectTreeRowData[];
  emptyState: ObjectTreeFamilyEmptyState;
  onSelect: (ref: WorkbenchObjectRef) => void;
  /**
   * Optional add affordance. When provided, renders an inline "+ <addLabel>"
   * button at the bottom of the section. Pergolas don't get this (their
   * creation is snap-driven from the toolbar) so the prop is omitted.
   */
  onAdd?: () => void;
  addLabel?: string;
  /** Disables the add button when the family can't accept new objects right now. */
  addDisabled?: boolean;
};

export function ObjectTreeSection({
  family,
  label,
  rows,
  emptyState,
  onSelect,
  onAdd,
  addLabel,
  addDisabled,
}: ObjectTreeSectionProps) {
  return (
    <section className={railStyles.section} data-object-tree-section={family}>
      <h4 className={railStyles.sectionTitle}>{label}</h4>
      <div className={railStyles.sectionBody}>
        {rows.length > 0 ? (
          <div className={railStyles.objectList}>
            {rows.map((row) => (
              <ObjectTreeRow
                key={`${family}:${row.objectId ?? 'none'}`}
                family={family}
                objectId={row.objectId}
                label={row.label}
                subtitle={row.subtitle}
                selected={row.selected}
                visibilityHidden={row.visibilityHidden}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className={sectionStyles.emptyState} data-object-tree-empty={family}>
            <p className={railStyles.empty}>{emptyState.message}</p>
            {emptyState.hint ? (
              <p className={sectionStyles.emptyHint}>{emptyState.hint}</p>
            ) : null}
          </div>
        )}
        {onAdd && addLabel ? (
          <button
            type="button"
            className={sectionStyles.addInline}
            data-action={`add-${family}`}
            disabled={addDisabled}
            onClick={onAdd}
          >
            <span aria-hidden="true">+</span>
            <span>{addLabel}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
