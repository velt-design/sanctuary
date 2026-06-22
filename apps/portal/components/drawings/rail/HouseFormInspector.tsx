'use client';

import { useMemo, type ReactNode } from 'react';
import type { ObjectWorkbenchHouseFormInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { FieldErrors, RunRoofCommit } from './objectWorkbenchRailTypes';
import { buildHouseFormFootprintSections } from './HouseFormFootprintSections';
import { buildHouseFormRoofSections } from './HouseFormRoofSections';
import styles from './WorkbenchRail.module.css';

/*
 * Right-inspector content for the selected house form.
 *
 * The primary section owns editable footprint and roof controls. Optional
 * dimension fields are supplied by the host because they come from the
 * drawing rail's canonical house-dimension mount.
 */

type HouseFormInspectorProps = {
  hasSelection: boolean;
  emptyTitle: string;
  emptyMessage: string;
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  runRoofCommit: RunRoofCommit;
  /**
   * House-context dimension fields (Eave height / Wall height / Soffit
   * depth / Fascia height / Gutter dimensions / Eave overhang) sourced
   * by the caller from a drawing rail mount in
   * `canonical_extras` mode. Rendered inside DIMENSIONS.
   */
  dimensionsPanel?: ReactNode;
};

export default function HouseFormInspector({
  hasSelection,
  emptyTitle,
  emptyMessage,
  houseFormContext,
  disabled,
  fieldErrors,
  runRoofCommit,
  dimensionsPanel,
}: HouseFormInspectorProps) {
  const footprintSections = useMemo(
    () =>
      buildHouseFormFootprintSections({
        fieldErrors,
      }),
    [fieldErrors],
  );

  const roofSections = useMemo(
    () =>
      buildHouseFormRoofSections({
        disabled,
        fieldErrors,
        houseFormContext,
        runRoofCommit,
      }),
    [disabled, fieldErrors, houseFormContext, runRoofCommit],
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
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Primary</h4>
        <div className={styles.sectionBody}>
          {footprintSections}
          {roofSections}
        </div>
      </section>

      {dimensionsPanel ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Dimensions</h4>
          <div className={styles.sectionBody}>{dimensionsPanel}</div>
        </section>
      ) : null}
    </>
  );
}
