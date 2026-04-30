'use client';

import { useMemo } from 'react';
import type { HouseFirstDeckDraft, HouseModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import { buildDeckInspectorSections } from './DeckInspectorSections';
import styles from './WorkbenchRail.module.css';

type DeckInspectorProps = {
  activeDeckId?: string | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  house: HouseModel | null;
  onAddDeck?: (mode: 'preset' | 'custom_outline') => Promise<CommitResult> | CommitResult;
  onCommitDeckPatch?: (
    deckId: string,
    patch: Partial<HouseFirstDeckDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveDeck?: (deckId: string) => Promise<CommitResult> | CommitResult;
  onStartDeckOutline?: (deckId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export default function DeckInspector({
  activeDeckId,
  disabled,
  fieldErrors,
  house,
  onAddDeck,
  onCommitDeckPatch,
  onRemoveDeck,
  onStartDeckOutline,
  runAction,
}: DeckInspectorProps) {
  const deckSections = useMemo(
    () =>
      buildDeckInspectorSections({
        activeDeckId,
        disabled,
        fieldErrors,
        house,
        onAddDeck,
        onCommitDeckPatch,
        onRemoveDeck,
        onStartDeckOutline,
        runAction,
      }),
    [
      activeDeckId,
      disabled,
      fieldErrors,
      house,
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
