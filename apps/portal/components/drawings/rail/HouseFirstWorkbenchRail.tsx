'use client';

import { useCallback, useMemo, useState } from 'react';
import { buildHouseRailDeckSections } from './houseRailDeckSections';
import { buildHouseRailFootprintSections } from './houseRailFootprintSections';
import { buildHouseRailOpeningSections } from './houseRailOpeningSections';
import { buildHouseRailOverviewSection } from './houseRailOverviewSection';
import { buildHouseRailRoofSections } from './houseRailRoofSections';
import { SummarySection, resolveCommitResult } from './houseRailShared';
import type {
  HouseFirstWorkbenchRailProps,
  HouseModeRailProps,
  RunAction,
  RunFootprintCommit,
  RunRoofCommit,
} from './houseRailTypes';
import styles from './ConfiguratorRail.module.css';

function HouseModeRail({
  house,
  activeDeckId,
  activeOpeningId,
  pergolas,
  warnings,
  disabled,
  canEditFootprint,
  canStartDrawOutline,
  onStartDrawOutline,
  onCommitFootprintEdit,
  onCommitRoofDraft,
  onSelectDeck,
  onSelectOpening,
  onAddDeck,
  onAddOpening,
  onRemoveDeck,
  onRemoveOpening,
  onCommitDeckPatch,
  onCommitOpeningPatch,
  onStartDeckOutline,
}: HouseModeRailProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const runFootprintCommit = useCallback<RunFootprintCommit>(
    async (fieldId, edit) => {
      const result = await resolveCommitResult(onCommitFootprintEdit?.(edit));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the shared house footprint.',
      }));
    },
    [onCommitFootprintEdit],
  );

  const runStartOutline = useCallback(async () => {
    const result = await resolveCommitResult(onStartDrawOutline?.());
    setFieldErrors((current) => ({
      ...current,
      outline: result.ok ? '' : result.error ?? 'Unable to start outline drawing.',
    }));
  }, [onStartDrawOutline]);

  const runRoofCommit = useCallback<RunRoofCommit>(
    async (fieldId, nextRoof) => {
      const result = await resolveCommitResult(onCommitRoofDraft?.(nextRoof));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the shared house roof.',
      }));
    },
    [onCommitRoofDraft],
  );

  const runDeckAction = useCallback<RunAction>(
    async (fieldId, action, fallbackMessage) => {
      const result = await resolveCommitResult(action);
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
    },
    [],
  );

  const overviewSection = useMemo(
    () =>
      buildHouseRailOverviewSection({
        house,
        pergolas,
        warnings,
      }),
    [house, pergolas, warnings],
  );

  const footprintSections = useMemo(
    () =>
      buildHouseRailFootprintSections({
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
      buildHouseRailRoofSections({
        disabled,
        fieldErrors,
        house,
        runRoofCommit,
      }),
    [disabled, fieldErrors, house, runRoofCommit],
  );

  const deckSections = useMemo(
    () =>
      buildHouseRailDeckSections({
        activeDeckId,
        disabled,
        fieldErrors,
        house,
        onAddDeck,
        onCommitDeckPatch,
        onRemoveDeck,
        onSelectDeck,
        onStartDeckOutline,
        runDeckAction,
      }),
    [
      activeDeckId,
      disabled,
      fieldErrors,
      house,
      onAddDeck,
      onCommitDeckPatch,
      onRemoveDeck,
      onSelectDeck,
      onStartDeckOutline,
      runDeckAction,
    ],
  );

  const openingSections = useMemo(
    () =>
      buildHouseRailOpeningSections({
        activeOpeningId,
        disabled,
        fieldErrors,
        house,
        onAddOpening,
        onCommitOpeningPatch,
        onRemoveOpening,
        onSelectOpening,
        runDeckAction,
      }),
    [
      activeOpeningId,
      disabled,
      fieldErrors,
      house,
      onAddOpening,
      onCommitOpeningPatch,
      onRemoveOpening,
      onSelectOpening,
      runDeckAction,
    ],
  );

  return (
    <div className={styles.rail}>
      {overviewSection}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Footprint</h4>
        <div className={styles.sectionBody}>{footprintSections}</div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Roof</h4>
        <div className={styles.sectionBody}>{roofSections}</div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Decks</h4>
        <div className={styles.sectionBody}>{deckSections}</div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Openings</h4>
        <div className={styles.sectionBody}>{openingSections}</div>
      </section>
    </div>
  );
}

export default function HouseFirstWorkbenchRail({
  workbenchMode,
  house,
  activeDeckId,
  activeOpeningId,
  pergolas,
  warnings,
  disabled,
  canEditFootprint,
  canStartDrawOutline,
  onStartDrawOutline,
  onCommitFootprintEdit,
  onCommitRoofDraft,
  onSelectDeck,
  onSelectOpening,
  onAddDeck,
  onAddOpening,
  onRemoveDeck,
  onRemoveOpening,
  onCommitDeckPatch,
  onCommitOpeningPatch,
  onStartDeckOutline,
  pergolaFallback,
}: HouseFirstWorkbenchRailProps) {
  if (workbenchMode === 'pergolas') {
    return (
      <div className={styles.rail}>
        <SummarySection
          title="Pergola Mode"
          items={[
            { label: 'Pergolas', value: String(pergolas.length) },
            { label: 'Shared house', value: house?.label ?? 'Not derived yet' },
            { label: 'Warnings', value: String(warnings.length) },
          ]}
          hint="Pergola editing is still routed through the existing Sanctuary fallback editor in this slice."
        />
        {pergolaFallback}
      </div>
    );
  }

  return (
    <HouseModeRail
      house={house}
      activeDeckId={activeDeckId}
      activeOpeningId={activeOpeningId}
      pergolas={pergolas}
      warnings={warnings}
      disabled={disabled}
      canEditFootprint={canEditFootprint}
      canStartDrawOutline={canStartDrawOutline}
      onStartDrawOutline={onStartDrawOutline}
      onCommitFootprintEdit={onCommitFootprintEdit}
      onCommitRoofDraft={onCommitRoofDraft}
      onSelectDeck={onSelectDeck}
      onSelectOpening={onSelectOpening}
      onAddDeck={onAddDeck}
      onAddOpening={onAddOpening}
      onRemoveDeck={onRemoveDeck}
      onRemoveOpening={onRemoveOpening}
      onCommitDeckPatch={onCommitDeckPatch}
      onCommitOpeningPatch={onCommitOpeningPatch}
      onStartDeckOutline={onStartDeckOutline}
    />
  );
}
