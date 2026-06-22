'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  emptyStateForFamily,
  familyVisibilityFor,
  subtitleForObjectTreeRow,
} from '@/lib/drawings/state/objectTreeRowSubtitles';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchRailModel } from '@/lib/drawings/state/drawingWorkbenchRailModel';
import type { WorkbenchObjectFamily, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { resolveCommitResult } from './objectRailShared';
import { ObjectTreeSection } from './objectTree/ObjectTreeSection';
import type { CommitResult } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

/*
 * Left rail for workbench visibility and object navigation.
 *
 * The rail always renders every object family. It owns the visibility
 * toggles, object tree composition, and family-level add affordances;
 * editing and diagnostics live in the right inspector.
 */

// Render order is intentionally product-facing: house forms first, then
// pergolas, decks, and openings. The data layer may use a different order.
const TREE_FAMILY_ORDER: ReadonlyArray<{ family: WorkbenchObjectFamily; label: string }> = [
  { family: 'house_forms', label: 'House Forms' },
  { family: 'pergolas', label: 'Pergolas' },
  { family: 'decks', label: 'Decks' },
  { family: 'openings', label: 'Openings' },
];

type ObjectWorkbenchRailInspectorContext = {
  onAddHouseForm?: () => Promise<CommitResult> | CommitResult;
  onAddPergola?: () => Promise<CommitResult> | CommitResult;
  onAddDeck?: () => Promise<CommitResult> | CommitResult;
  onAddOpening?: () => Promise<CommitResult> | CommitResult;
};

type ObjectWorkbenchRailProps = {
  model: DrawingWorkbenchRailModel;
  disabled?: boolean;
  activeObjectRef: WorkbenchObjectRef;
  visibility: DrawingWorkbenchVisibilityState;
  onSelectObjectRef?: (ref: WorkbenchObjectRef) => void;
  onVisibilityChange?: (family: keyof DrawingWorkbenchVisibilityState, visible: boolean) => void;
  inspectorContext: ObjectWorkbenchRailInspectorContext;
};

export default function ObjectWorkbenchRail({
  model,
  disabled,
  activeObjectRef,
  visibility,
  onSelectObjectRef,
  onVisibilityChange,
  inspectorContext,
}: ObjectWorkbenchRailProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { onAddHouseForm, onAddPergola, onAddDeck, onAddOpening } = inspectorContext;

  const runAddHouseForm = useCallback(async () => {
    const result = await resolveCommitResult(onAddHouseForm?.());
    setFieldErrors((current) => ({
      ...current,
      addHouseForm: result.ok ? '' : result.error ?? 'Unable to add a new house form.',
    }));
  }, [onAddHouseForm]);

  const runAddDeck = useCallback(async () => {
    const result = await resolveCommitResult(onAddDeck?.());
    setFieldErrors((current) => ({
      ...current,
      addDeck: result.ok ? '' : result.error ?? 'Unable to add a new deck.',
    }));
  }, [onAddDeck]);

  const runAddPergola = useCallback(async () => {
    const result = await resolveCommitResult(onAddPergola?.());
    setFieldErrors((current) => ({
      ...current,
      addPergola: result.ok ? '' : result.error ?? 'Unable to add a new pergola.',
    }));
  }, [onAddPergola]);

  const runAddOpening = useCallback(async () => {
    const result = await resolveCommitResult(onAddOpening?.());
    setFieldErrors((current) => ({
      ...current,
      addOpening: result.ok ? '' : result.error ?? 'Unable to add a new opening.',
    }));
  }, [onAddOpening]);

  const familyRows = useMemo(() => {
    return TREE_FAMILY_ORDER.map(({ family }) => {
      const entries = model.objectLists[family];
      const familyVisible = familyVisibilityFor(family, visibility);
      const rows = entries.map((entry) => {
        const selected =
          activeObjectRef.family === entry.ref.family &&
          activeObjectRef.objectId === entry.ref.objectId;
        return {
          objectId: entry.ref.objectId,
          label: entry.label,
          subtitle: subtitleForObjectTreeRow({ entry, selected, familyVisible }),
          selected,
          visibilityHidden: !familyVisible,
        };
      });
      return { family, rows };
    });
  }, [activeObjectRef, model.objectLists, visibility]);

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

      <div className={styles.rail} data-object-tree="true" aria-label="Workbench objects">
        {TREE_FAMILY_ORDER.map(({ family, label }, index) => {
          const { rows } = familyRows[index]!;
          const addConfig = (() => {
            switch (family) {
              case 'house_forms':
                return {
                  onAdd: onAddHouseForm ? runAddHouseForm : undefined,
                  addLabel: 'Add structure',
                  addDisabled: !onAddHouseForm || disabled,
                };
              case 'pergolas':
                return {
                  onAdd: onAddPergola ? runAddPergola : undefined,
                  addLabel: 'Add pergola',
                  addDisabled: !onAddPergola || disabled,
                };
              case 'decks':
                return {
                  onAdd: onAddDeck ? runAddDeck : undefined,
                  addLabel: 'Add deck',
                  addDisabled: !onAddDeck || disabled,
                };
              case 'openings':
                return {
                  onAdd: onAddOpening ? runAddOpening : undefined,
                  addLabel: 'Add opening',
                  addDisabled: !onAddOpening || disabled,
                };
              default:
                return { onAdd: undefined, addLabel: undefined, addDisabled: undefined };
            }
          })();
          return (
            <ObjectTreeSection
              key={family}
              family={family}
              label={label}
              rows={rows}
              emptyState={emptyStateForFamily(family)}
              onSelect={(ref) => onSelectObjectRef?.(ref)}
              onAdd={addConfig.onAdd}
              addLabel={addConfig.addLabel}
              addDisabled={addConfig.addDisabled}
            />
          );
        })}
      </div>

      {fieldErrors.addHouseForm ? (
        <p className={styles.fieldError}>{fieldErrors.addHouseForm}</p>
      ) : null}
      {fieldErrors.addDeck ? (
        <p className={styles.fieldError}>{fieldErrors.addDeck}</p>
      ) : null}
      {fieldErrors.addPergola ? (
        <p className={styles.fieldError}>{fieldErrors.addPergola}</p>
      ) : null}
      {fieldErrors.addOpening ? (
        <p className={styles.fieldError}>{fieldErrors.addOpening}</p>
      ) : null}
    </div>
  );
}
