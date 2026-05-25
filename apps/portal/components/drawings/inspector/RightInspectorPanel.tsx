'use client';

import type { ReactNode } from 'react';
import styles from './RightInspectorPanel.module.css';

/*
 * PR-W3b (2026-05-23) — scaffold for the CAD-style right-inspector slot.
 *
 * This is a *placeholder* implementation. PR-W3c moves the per-object input
 * sections (currently in SanctuaryWorkbenchRail) into here, one family at a
 * time. PR-W3d finishes by deleting the now-empty per-object input UI from
 * the left rail (the left rail then carries VISIBILITY + OBJECTS TREE only).
 *
 * Why scaffold first: the new 3-column grid + this panel become the mount
 * point for the moved sections. Landing the slot in isolation removes
 * layout churn from each subsequent section migration PR.
 */

type RightInspectorPanelProps = {
  /**
   * Header label — e.g. "Pergola 1" when a pergola is selected, "House Form"
   * when a house form is selected. Empty when no selection.
   */
  selectionLabel?: string | null;
  /**
   * Trust-status pill text — e.g. "Geometry ready", "Approximate", "Blocked".
   * Empty when no selection or no trust state.
   */
  trustStatusLabel?: string | null;
  /**
   * Section content. Sections come from PR-W3c-era extractions.
   */
  children?: ReactNode;
};

export default function RightInspectorPanel({
  selectionLabel,
  trustStatusLabel,
  children,
}: RightInspectorPanelProps) {
  const trimmedSelectionLabel = selectionLabel?.trim() ?? '';
  const trimmedTrustStatus = trustStatusLabel?.trim() ?? '';
  const hasContent = Boolean(children);

  return (
    <section
      className={styles.panel}
      data-right-inspector="true"
      data-right-inspector-state={hasContent ? 'populated' : 'empty'}
      aria-label="Selected object inspector"
    >
      <header className={styles.header}>
        <div className={styles.headerEyebrow}>SELECTED OBJECT</div>
        <div className={styles.headerTitleRow}>
          <h3 className={styles.headerTitle}>
            {trimmedSelectionLabel || 'No selection'}
          </h3>
          {trimmedTrustStatus ? (
            <span className={styles.trustPill}>{trimmedTrustStatus}</span>
          ) : null}
        </div>
      </header>
      <div className={styles.body}>
        {hasContent ? (
          children
        ) : (
          <p className={styles.emptyHint}>
            Select an object from the left tree or canvas to edit its
            properties here.
          </p>
        )}
      </div>
    </section>
  );
}
