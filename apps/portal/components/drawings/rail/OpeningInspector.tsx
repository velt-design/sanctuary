'use client';

import { useMemo } from 'react';
import type {
  HouseFirstOpeningDraft,
  HouseModel,
  WallOpeningKind,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import { buildOpeningInspectorSections } from './OpeningInspectorSections';
import styles from './WorkbenchRail.module.css';

type OpeningInspectorProps = {
  activeOpeningId?: string | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  house: HouseModel | null;
  onAddOpening?: (
    kind: Extract<WallOpeningKind, 'window' | 'hinged_door' | 'slider' | 'stacker'>,
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: Partial<HouseFirstOpeningDraft>,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export default function OpeningInspector({
  activeOpeningId,
  disabled,
  fieldErrors,
  house,
  onAddOpening,
  onCommitOpeningPatch,
  onRemoveOpening,
  runAction,
}: OpeningInspectorProps) {
  const openingSections = useMemo(
    () =>
      buildOpeningInspectorSections({
        activeOpeningId,
        disabled,
        fieldErrors,
        house,
        onAddOpening,
        onCommitOpeningPatch,
        onRemoveOpening,
        runAction,
      }),
    [
      activeOpeningId,
      disabled,
      fieldErrors,
      house,
      onAddOpening,
      onCommitOpeningPatch,
      onRemoveOpening,
      runAction,
    ],
  );

  return (
    <section className={styles.section}>
      <h4 className={styles.sectionTitle}>Opening Inspector</h4>
      <div className={styles.sectionBody}>{openingSections}</div>
    </section>
  );
}
