'use client';

import type { ReactNode } from 'react';
import styles from './RightInspectorPanel.module.css';

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
  /** Selected-object inspector sections supplied by WorkbenchInspectorHost. */
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
