'use client';

import { useCallback, useState } from 'react';
import DeckInspector from './DeckInspector';
import HouseFormInspector from './HouseFormInspector';
import OpeningInspector from './OpeningInspector';
import { resolveCommitResult } from './objectRailShared';
import type {
  ObjectWorkbenchRailProps,
  RunAction,
  RunFootprintCommit,
  RunRoofCommit,
} from './objectWorkbenchRailTypes';
import styles from './ConfiguratorRail.module.css';

export default function ObjectWorkbenchRail({
  model,
  disabled,
  activeRailTab,
  activeObjectRef,
  visibility,
  onSelectRailTab,
  onSelectObjectRef,
  onVisibilityChange,
  inspectorContext,
}: ObjectWorkbenchRailProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const {
    house,
    pergolas,
    warnings,
    activeDeckId,
    activeOpeningId,
    canEditFootprint,
    canStartDrawOutline,
    onStartDrawOutline,
    onCommitFootprintEdit,
    onCommitRoofDraft,
    onAddDeck,
    onAddOpening,
    onRemoveDeck,
    onRemoveOpening,
    onCommitDeckPatch,
    onCommitOpeningPatch,
    onStartDeckOutline,
    houseFormAttachmentContextPanel,
    pergolaInspectorPanel,
    diagnosticsPanel,
  } = inspectorContext;

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

  const runInspectorAction = useCallback<RunAction>(
    async (fieldId, action, fallbackMessage) => {
      const result = await resolveCommitResult(action);
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? fallbackMessage,
      }));
    },
    [],
  );

  const activeFamily =
    activeRailTab === 'diagnostics' ? model.selectedInspector.family : activeRailTab;
  const activeObjectEntries = model.objectLists[activeFamily];
  const activeObjectKey = `${activeFamily}:${activeObjectRef.objectId ?? 'none'}`;

  const inspectorPanel =
    activeRailTab === 'diagnostics' ? (
      diagnosticsPanel
    ) : (
      <div data-active-workbench-object={activeObjectKey}>
        {activeFamily === 'house_forms' ? (
          <HouseFormInspector
            hasSelection={model.selectedInspector.hasSelection}
            emptyTitle={model.selectedInspector.emptyTitle}
            emptyMessage={model.selectedInspector.emptyMessage}
            house={house}
            pergolas={pergolas}
            warnings={warnings}
            disabled={disabled}
            fieldErrors={fieldErrors}
            canEditFootprint={canEditFootprint}
            canStartDrawOutline={canStartDrawOutline}
            runFootprintCommit={runFootprintCommit}
            runStartOutline={runStartOutline}
            runRoofCommit={runRoofCommit}
            attachmentContextPanel={houseFormAttachmentContextPanel}
          />
        ) : activeFamily === 'pergolas' ? (
          model.selectedInspector.hasSelection ? (
            pergolaInspectorPanel
          ) : (
            <section className={styles.section}>
              <h4 className={styles.sectionTitle}>{model.selectedInspector.emptyTitle}</h4>
              <div className={styles.sectionBody}>
                <p className={styles.empty}>{model.selectedInspector.emptyMessage}</p>
              </div>
            </section>
          )
        ) : activeFamily === 'decks' ? (
          <DeckInspector
            activeDeckId={activeDeckId}
            disabled={disabled}
            fieldErrors={fieldErrors}
            house={house}
            onAddDeck={onAddDeck}
            onCommitDeckPatch={onCommitDeckPatch}
            onRemoveDeck={onRemoveDeck}
            onStartDeckOutline={onStartDeckOutline}
            runAction={runInspectorAction}
          />
        ) : (
          <OpeningInspector
            activeOpeningId={activeOpeningId}
            disabled={disabled}
            fieldErrors={fieldErrors}
            house={house}
            onAddOpening={onAddOpening}
            onCommitOpeningPatch={onCommitOpeningPatch}
            onRemoveOpening={onRemoveOpening}
            runAction={runInspectorAction}
          />
        )}
      </div>
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
        <h4 className={styles.sectionTitle}>Object Navigator</h4>
        <div className={styles.navigatorStack} role="tablist" aria-label="Workbench object families">
          {model.familySummaries.map((family) => {
            const active = activeRailTab === family.family;
            return (
              <button
                key={family.family}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${active ? styles.buttonPrimary : styles.secondaryButton} ${styles.navigatorButton}`}
                onClick={() => onSelectRailTab?.(family.family)}
              >
                <span className={styles.navigatorLabel}>{family.label}</span>
                <span className={styles.navigatorMeta}>{family.countLabel}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={activeRailTab === 'diagnostics'}
            className={`${activeRailTab === 'diagnostics' ? styles.buttonPrimary : styles.secondaryButton} ${styles.navigatorButton}`}
            onClick={() => onSelectRailTab?.('diagnostics')}
          >
            <span className={styles.navigatorLabel}>Diagnostics</span>
            <span className={styles.navigatorMeta}>Compatibility checks</span>
          </button>
        </div>
      </section>

      {activeRailTab !== 'diagnostics' ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>{model.selectedInspector.familyLabel}</h4>
          <div className={styles.sectionBody}>
            {activeObjectEntries.length ? (
              <div className={styles.objectList}>
                {activeObjectEntries.map((entry) => {
                  const selected =
                    activeObjectRef.family === entry.ref.family && activeObjectRef.objectId === entry.ref.objectId;
                  return (
                    <button
                      key={`${entry.ref.family}:${entry.ref.objectId ?? 'none'}`}
                      type="button"
                      data-workbench-object-button={`${entry.ref.family}:${entry.ref.objectId ?? 'none'}`}
                      className={`${selected ? styles.buttonPrimary : styles.secondaryButton} ${styles.objectButton}`}
                      onClick={() => onSelectObjectRef?.(entry.ref)}
                    >
                      <span className={styles.objectButtonLabel}>{entry.label}</span>
                      <span className={styles.objectButtonMeta}>
                        {entry.statusLabel}
                        {entry.meta ? ` • ${entry.meta}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.empty}>{model.selectedInspector.emptyMessage}</p>
            )}
            {model.selectedInspector.addActionLabels.length ? (
              <p className={styles.fieldHint}>
                Available actions: {model.selectedInspector.addActionLabels.join(', ')}.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeRailTab !== 'diagnostics' && model.selectedInspector.hasSelection ? (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Selected Object</h4>
          <div className={styles.sectionBody}>
            <div className={styles.inlineMeta}>
              <span className={styles.inlineLabel}>{model.selectedInspector.singularLabel}</span>
              <span className={styles.inlineValue}>{model.selectedInspector.selectedObjectLabel}</span>
            </div>
            {model.selectedInspector.selectedObjectStatusLabel || model.selectedInspector.selectedObjectMeta ? (
              <p className={styles.fieldHint}>
                {[model.selectedInspector.selectedObjectStatusLabel, model.selectedInspector.selectedObjectMeta]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {inspectorPanel}
    </div>
  );
}
