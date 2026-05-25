'use client';

import { useCallback, useState } from 'react';
import { resolveCommitResult } from './objectRailShared';
import type { ObjectWorkbenchRailProps } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

/*
 * PR-W3c (2026-05-25) — rail is now navigation-only.
 *
 * The per-family inspector panels (PergolaInspector, HouseFormInspector,
 * DeckInspector, OpeningInspector, DiagnosticsPanel) moved into
 * `WorkbenchInspectorHost` and render in the right-side `RightInspectorPanel`.
 * The rail keeps visibility toggles, the object navigator, and the selected-
 * object summary; the inspector slot below the summary is gone.
 *
 * PR-W3d will further reduce the rail to VISIBILITY + OBJECTS TREE only,
 * collapsing the Object Navigator tabs once the right inspector resolves
 * which family is active from the underlying selection.
 */

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
  const { onAddHouseForm } = inspectorContext;

  const runAddHouseForm = useCallback(async () => {
    const result = await resolveCommitResult(onAddHouseForm?.());
    setFieldErrors((current) => ({
      ...current,
      addHouseForm: result.ok ? '' : result.error ?? 'Unable to add a new house form.',
    }));
  }, [onAddHouseForm]);

  const activeFamily =
    activeRailTab === 'diagnostics' ? model.selectedInspector.family : activeRailTab;
  const activeObjectEntries = model.objectLists[activeFamily];

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
            {activeFamily === 'house_forms' && onAddHouseForm ? (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.objectButton}`}
                data-action="add-house-form"
                disabled={disabled}
                onClick={runAddHouseForm}
              >
                <span className={styles.objectButtonLabel}>Add structure</span>
                <span className={styles.objectButtonMeta}>
                  Clones the selected house 10 m east
                </span>
              </button>
            ) : null}
            {fieldErrors.addHouseForm ? (
              <p className={styles.fieldError}>{fieldErrors.addHouseForm}</p>
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
            {model.selectedInspector.selectedObjectTrustLabel ? (
              <div className={styles.inlineMeta}>
                <span className={styles.inlineLabel}>Trust</span>
                <span className={styles.inlineValue}>{model.selectedInspector.selectedObjectTrustLabel}</span>
              </div>
            ) : null}
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
    </div>
  );
}
