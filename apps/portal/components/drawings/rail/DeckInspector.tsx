'use client';

import { useMemo } from 'react';
import type {
  ObjectWorkbenchDeckInspectorModel,
  ObjectWorkbenchDeckPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import { buildDeckInspectorSections } from './DeckInspectorSections';
import styles from './WorkbenchRail.module.css';

type DeckInspectorProps = {
  activeDeck: ObjectWorkbenchDeckInspectorModel | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  onCommitDeckPatch?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export default function DeckInspector({
  activeDeck,
  disabled,
  fieldErrors,
  onCommitDeckPatch,
  onRemoveDeck,
  runAction,
}: DeckInspectorProps) {
  const deckSections = useMemo(
    () =>
      buildDeckInspectorSections({
        activeDeck,
        disabled,
        fieldErrors,
        onCommitDeckPatch,
        onRemoveDeck,
        runAction,
      }),
    [
      activeDeck,
      disabled,
      fieldErrors,
      onCommitDeckPatch,
      onRemoveDeck,
      runAction,
    ],
  );

  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>Deck Inspector</h4>
      <div className={styles.sectionBody}>{deckSections}</div>
    </section>
  );
}
