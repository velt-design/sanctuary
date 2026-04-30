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
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export default function DeckInspector({
  activeDeck,
  disabled,
  fieldErrors,
  onAddDeck,
  onCommitDeckPatch,
  onRemoveDeck,
  onStartDeckOutline,
  runAction,
}: DeckInspectorProps) {
  const deckSections = useMemo(
    () =>
      buildDeckInspectorSections({
        activeDeck,
        disabled,
        fieldErrors,
        onAddDeck,
        onCommitDeckPatch,
        onRemoveDeck,
        onStartDeckOutline,
        runAction,
      }),
    [
      activeDeck,
      disabled,
      fieldErrors,
      onAddDeck,
      onCommitDeckPatch,
      onRemoveDeck,
      onStartDeckOutline,
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
