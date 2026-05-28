'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  emptyStateForFamily,
  familyVisibilityFor,
  subtitleForObjectTreeRow,
} from '@/lib/drawings/state/objectTreeRowSubtitles';
import type { WorkbenchObjectFamily } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { resolveCommitResult } from './objectRailShared';
import { ObjectTreeSection } from './objectTree/ObjectTreeSection';
import type { ObjectWorkbenchRailProps } from './objectWorkbenchRailTypes';
import styles from './WorkbenchRail.module.css';

/*
 * PR-W3d (2026-05-25) — CAD-style left rail: VISIBILITY + flat OBJECTS TREE.
 *
 * Removed:
 *  - Object Navigator tab strip (forced one-family-at-a-time view)
 *  - Selected Object summary section (duplicated info — selection signal
 *    lives in the tree row highlight; trust pill lives in the right
 *    inspector header)
 *  - Diagnostics tab (debug content, future access via top bar `…` menu)
 *
 * What stays:
 *  - Visibility toggles (House / Pergolas / Decks / Openings)
 *  - Four `<ObjectTreeSection>` blocks always rendered simultaneously, one
 *    per family. Order matches the mockup.
 *
 * Row content + subtitle derivation lives in `objectTreeRowSubtitles.ts`
 * (PR-W3d.1); row/section primitives live in `objectTree/` (PR-W3d.2).
 * This file is now pure composition + visibility section.
 */

// Family render order matches the mockup: House Forms → Pergolas → Decks →
// Openings. Distinct from the rail model's internal `FAMILY_ORDER` so the
// outliner reads top-down by spatial-entity importance regardless of how
// the data layer orders families.
const TREE_FAMILY_ORDER: ReadonlyArray<{ family: WorkbenchObjectFamily; label: string }> = [
  { family: 'house_forms', label: 'House Forms' },
  { family: 'pergolas', label: 'Pergolas' },
  { family: 'decks', label: 'Decks' },
  { family: 'openings', label: 'Openings' },
];

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
  const { onAddHouseForm, onAddDeck, onAddOpening } = inspectorContext;

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

  const runAddOpening = useCallback(async () => {
    const result = await resolveCommitResult(onAddOpening?.());
    setFieldErrors((current) => ({
      ...current,
      addOpening: result.ok ? '' : result.error ?? 'Unable to add a new opening.',
    }));
  }, [onAddOpening]);

  // Pre-compose the per-family row data so the JSX stays declarative.
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
          // PR-T6 (2026-05-26): per-family add affordance. All four
          // families render the "+ Add X" pill for visual consistency
          // with the mockup. Pergolas have no production add handler
          // yet, so the pill renders disabled rather than absent —
          // visual completeness, real limit communicated.
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
                  onAdd: () => undefined,
                  addLabel: 'Add pergola',
                  addDisabled: true,
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
      {fieldErrors.addOpening ? (
        <p className={styles.fieldError}>{fieldErrors.addOpening}</p>
      ) : null}
    </div>
  );
}
