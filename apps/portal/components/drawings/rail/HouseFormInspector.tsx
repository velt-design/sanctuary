'use client';

import { useMemo, type ReactNode } from 'react';
import type { HouseFirstMigrationWarning, HouseModel, PergolaModel } from '@/lib/drawings/state/houseFirstWorkbenchModel';
import type { FieldErrors, RunFootprintCommit, RunRoofCommit } from './objectWorkbenchRailTypes';
import { buildHouseFormFootprintSections } from './HouseFormFootprintSections';
import { buildHouseFormOverviewSection } from './HouseFormOverviewSection';
import { buildHouseFormRoofSections } from './HouseFormRoofSections';
import styles from './ConfiguratorRail.module.css';

type HouseFormInspectorProps = {
  hasSelection: boolean;
  emptyTitle: string;
  emptyMessage: string;
  house: HouseModel | null;
  pergolas: PergolaModel[];
  warnings: HouseFirstMigrationWarning[];
  disabled?: boolean;
  fieldErrors: FieldErrors;
  canEditFootprint?: boolean;
  canStartDrawOutline?: boolean;
  runFootprintCommit: RunFootprintCommit;
  runStartOutline: () => Promise<void>;
  runRoofCommit: RunRoofCommit;
  attachmentContextPanel?: ReactNode;
};

export default function HouseFormInspector({
  hasSelection,
  emptyTitle,
  emptyMessage,
  house,
  pergolas,
  warnings,
  disabled,
  fieldErrors,
  canEditFootprint,
  canStartDrawOutline,
  runFootprintCommit,
  runStartOutline,
  runRoofCommit,
  attachmentContextPanel,
}: HouseFormInspectorProps) {
  const overviewSection = useMemo(
    () =>
      buildHouseFormOverviewSection({
        house,
        pergolas,
        warnings,
      }),
    [house, pergolas, warnings],
  );

  const footprintSections = useMemo(
    () =>
      buildHouseFormFootprintSections({
        canEditFootprint,
        canStartDrawOutline,
        disabled,
        fieldErrors,
        house,
        runFootprintCommit,
        runStartOutline,
      }),
    [
      canEditFootprint,
      canStartDrawOutline,
      disabled,
      fieldErrors,
      house,
      runFootprintCommit,
      runStartOutline,
    ],
  );

  const roofSections = useMemo(
    () =>
      buildHouseFormRoofSections({
        disabled,
        fieldErrors,
        house,
        runRoofCommit,
      }),
    [disabled, fieldErrors, house, runRoofCommit],
  );

  if (!hasSelection) {
    return (
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>{emptyTitle}</h4>
        <div className={styles.sectionBody}>
          <p className={styles.empty}>{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {overviewSection}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Footprint</h4>
        <div className={styles.sectionBody}>{footprintSections}</div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Roof</h4>
        <div className={styles.sectionBody}>{roofSections}</div>
      </section>

      {attachmentContextPanel ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Attachment Context</h4>
          <div className={styles.sectionBody}>{attachmentContextPanel}</div>
        </section>
      ) : null}
    </>
  );
}
