'use client';

import { useMemo } from 'react';
import type { OpeningObjectModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {
  ObjectWorkbenchOpeningInspectorModel,
  ObjectWorkbenchOpeningPatch,
} from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { CommitResult, FieldErrors, RunAction } from './objectWorkbenchRailTypes';
import { buildOpeningInspectorSections } from './OpeningInspectorSections';
import styles from './WorkbenchRail.module.css';

type OpeningInspectorProps = {
  activeOpening: ObjectWorkbenchOpeningInspectorModel | null;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  onAddOpening?: (
    kind: Extract<OpeningObjectModel['kind'], 'window' | 'hinged_door' | 'slider' | 'stacker'>,
  ) => Promise<CommitResult> | CommitResult;
  onCommitOpeningPatch?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<CommitResult> | CommitResult;
  onRemoveOpening?: (openingId: string) => Promise<CommitResult> | CommitResult;
  runAction: RunAction;
};

export default function OpeningInspector({
  activeOpening,
  disabled,
  fieldErrors,
  onAddOpening,
  onCommitOpeningPatch,
  onRemoveOpening,
  runAction,
}: OpeningInspectorProps) {
  const openingSections = useMemo(
    () =>
      buildOpeningInspectorSections({
        activeOpening,
        disabled,
        fieldErrors,
        onAddOpening,
        onCommitOpeningPatch,
        onRemoveOpening,
        runAction,
      }),
    [
      activeOpening,
      disabled,
      fieldErrors,
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
