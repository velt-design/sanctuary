'use client';

import { useCallback, useMemo, useState } from 'react';
import type { DrawingWorkbenchRailTab } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildHouseRailDeckSections } from './houseRailDeckSections';
import { buildHouseRailFootprintSections } from './houseRailFootprintSections';
import { buildHouseRailOpeningSections } from './houseRailOpeningSections';
import { buildHouseRailOverviewSection } from './houseRailOverviewSection';
import { buildHouseRailRoofSections } from './houseRailRoofSections';
import { resolveCommitResult } from './houseRailShared';
import type {
  HouseFirstWorkbenchRailProps,
  RunAction,
  RunFootprintCommit,
  RunRoofCommit,
} from './houseRailTypes';
import styles from './ConfiguratorRail.module.css';

const RAIL_TABS: Array<{ id: DrawingWorkbenchRailTab; label: string }> = [
  { id: 'house_forms', label: 'House Forms' },
  { id: 'pergolas', label: 'Pergolas' },
  { id: 'decks', label: 'Decks' },
  { id: 'openings', label: 'Openings' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

export default function HouseFirstWorkbenchRail({
  house,
  pergolas,
  warnings,
  disabled,
  activeRailTab,
  activeObjectRef,
  activeDeckId,
  activeOpeningId,
  canEditFootprint,
  canStartDrawOutline,
  visibility,
  onSelectRailTab,
  onVisibilityChange,
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
  houseContextPanel,
  pergolaInspectorPanel,
  diagnosticsPanel,
}: HouseFirstWorkbenchRailProps) {
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
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Visibility</h4>
        <div className={styles.sectionBody}>
          {(
            [
              ['house', 'House'],
              ['pergolas', 'Pergolas'],
              ['decks', 'Decks'],
              ['openings', 'Openings'],
            ] as const
          ).map(([family, label]) => {
            const visible = visibility[family];
            return (
              <div key={family} className={styles.inlineMeta}>
                <span className={styles.inlineLabel}>{label}</span>
                <button
                  type="button"
                  className={`${styles.toggleButton} ${visible ? styles.toggleButtonActive : ''}`}
                  aria-label={`${label} visibility`}
                  aria-pressed={visible}
                  onClick={() => onVisibilityChange?.(family, !visible)}
                >
                  {visible ? 'Shown' : 'Hidden'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Editor</h4>
        <div className={styles.fieldStack} role="tablist" aria-label="Workbench editor tabs">
          {RAIL_TABS.map((tab) => {
            const active = activeRailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? styles.buttonPrimary : styles.secondaryButton}
                onClick={() => onSelectRailTab?.(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeRailTab === 'house_forms' ? (
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

          {houseContextPanel ? (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>Attachment Context</h4>
              <div className={styles.sectionBody}>{houseContextPanel}</div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeRailTab === 'pergolas' ? (
        <div data-active-workbench-object={`${activeObjectRef.family}:${activeObjectRef.objectId ?? 'none'}`}>
          {pergolaInspectorPanel}
        </div>
      ) : null}

      {activeRailTab === 'decks' ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Decks</h4>
          <div className={styles.sectionBody}>{deckSections}</div>
        </section>
      ) : null}

      {activeRailTab === 'openings' ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Openings</h4>
          <div className={styles.sectionBody}>{openingSections}</div>
        </section>
      ) : null}

      {activeRailTab === 'diagnostics' ? diagnosticsPanel : null}
    </div>
  );
}
