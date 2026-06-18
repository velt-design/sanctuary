'use client';

import { useMemo, type ReactNode } from 'react';
import type { ObjectWorkbenchHouseFormInspectorModel } from '@/lib/drawings/state/objectWorkbenchInspectorModel';
import type { FieldErrors, RunFootprintCommit, RunRoofCommit } from './objectWorkbenchRailTypes';
import { buildHouseFormFootprintSections } from './HouseFormFootprintSections';
import { buildHouseFormRoofSections } from './HouseFormRoofSections';
import styles from './WorkbenchRail.module.css';

/*
 * PR-T7 (2026-05-29) — house inspector restructured to PRIMARY /
 * DIMENSIONS / ADVANCED, matching the pergola inspector (PR-W12).
 *
 * Cut:
 *   • `HouseFormOverviewSection` — every row duplicated the header chip,
 *     the editable field below it, or the OBJECTS TREE on the left.
 *   • Outer "Attachment Context" wrapper — the embedded SanctuaryWorkbench-
 *     Rail in canonical_extras mode emitted its own section title, so
 *     the outer wrapper was a duplicate heading.
 *   • Dead/derived dropdowns (House connection / Attachment strategy /
 *     Storey mode / Rotate buttons / gable gutter readouts / Drawing
 *     rotation) — removed from the old shared rail field defs.
 *
 * What stays:
 *   • The footprint-sections factory (footprint mode / preset / dimensions)
 *   • The roof-sections factory (roof form / pitch / material / fall /
 *     ridge / open-end toggles)
 *   • House dimension fields (eave / wall / soffit / fascia / gutter /
 *     overhang) surfaced via the embedded drawing rail in canonical_extras
 *     mode because they drive the house's actual rendering.
 *
 * Grouping:
 *   PRIMARY    = footprint preset + attachment side + roof form + pitch
 *                + material (the editable identity of the form)
 *   DIMENSIONS = the canonical-extras house dimensions (eave / wall /
 *                soffit / fascia / gutters / overhang)
 *   ADVANCED   = footprint mode + dimension params +
 *                fall direction / ridge orientation / open-end toggles
 *
 * For now PRIMARY + ADVANCED come from the footprint/roof factories
 * inline (they already split by "primary identity" vs "tuning"). The
 * embedded rail's canonical_extras output becomes DIMENSIONS.
 */

type HouseFormInspectorProps = {
  hasSelection: boolean;
  emptyTitle: string;
  emptyMessage: string;
  houseFormContext: ObjectWorkbenchHouseFormInspectorModel;
  disabled?: boolean;
  fieldErrors: FieldErrors;
  canEditFootprint?: boolean;
  runFootprintCommit: RunFootprintCommit;
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
  canEditFootprint,
  runFootprintCommit,
  runRoofCommit,
  dimensionsPanel,
}: HouseFormInspectorProps) {
  const footprintSections = useMemo(
    () =>
      buildHouseFormFootprintSections({
        canEditFootprint,
        disabled,
        fieldErrors,
        houseForm: houseFormContext.houseForm,
        runFootprintCommit,
      }),
    [
      canEditFootprint,
      disabled,
      fieldErrors,
      houseFormContext.houseForm,
      runFootprintCommit,
    ],
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
