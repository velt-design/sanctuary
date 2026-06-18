'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import DeckInspector from '@/components/drawings/rail/DeckInspector';
import HouseFormInspector from '@/components/drawings/rail/HouseFormInspector';
import OpeningInspector from '@/components/drawings/rail/OpeningInspector';
import { resolveCommitResult } from '@/components/drawings/rail/objectRailShared';
import type {
  RunAction,
  RunFootprintCommit,
  RunRoofCommit,
} from '@/components/drawings/rail/objectWorkbenchRailTypes';
import workbenchRailStyles from '@/components/drawings/rail/WorkbenchRail.module.css';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';
import PergolaInspector from './PergolaInspector';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';

/*
 * PR-W3c (2026-05-25) — right-inspector content host.
 *
 * Mounts the per-family inspector content (PergolaInspector,
 * HouseFormInspector, DeckInspector, OpeningInspector, DiagnosticsPanel)
 * for the active rail tab + selection. Extracted from ObjectWorkbenchRail
 * so the inspector content can render in the right-side panel while the
 * left rail keeps its visibility + object-tree navigation.
 *
 * The host takes the same props as ObjectWorkbenchRailHost — both are
 * sibling consumers of `DrawingWorkbenchStore` + the action hooks. The rail
 * host renders the left nav; this host renders the right inspector. Action
 * dispatch is shared; the surfaces are independent visual mounts.
 *
 * This host is the right-side inspector consumer for object-first workbench
 * state; the left rail remains navigation and visibility only.
 */

type WorkbenchInspectorHostProps = {
  isLocked: boolean;
  objectSelectionActions: ObjectWorkbenchSelectionActions;
  objectWorkbenchActions: ObjectWorkbenchActions;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  store: DrawingWorkbenchStore;
};

export default function WorkbenchInspectorHost({
  isLocked,
  objectSelectionActions,
  objectWorkbenchActions,
  setUi,
  store,
}: WorkbenchInspectorHostProps) {
  const activePergolaModel =
    store.derived.objectWorkbench.activePergola ??
    store.derived.objectWorkbench.pergolas[0] ??
    null;
  const defaultPergolaId =
    store.ui.activeObjectFamily === 'pergolas' && store.ui.activeObjectRef.objectId
      ? store.ui.activeObjectRef.objectId
      : store.derived.objectWorkbench.activePergola?.id ??
        store.derived.railModel.objectLists.pergolas[0]?.ref.objectId ??
        null;

  const handleRailTabSelect = useCallback(
    (tab: DrawingWorkbenchRailTab) => {
      if (tab !== 'pergolas') {
        objectSelectionActions.selectRailTab(tab);
        return;
      }

      setUi((current) =>
        buildPergolaSelectionUiState({
          current,
          pergolaId: defaultPergolaId,
        }),
      );
    },
    [defaultPergolaId, objectSelectionActions, setUi],
  );

  const handleCanonicalPergolaSelection = useCallback(
    (pergolaId: string | null) => {
      setUi((current) =>
        buildPergolaSelectionUiState({
          current,
          pergolaId,
        }),
      );
    },
    [setUi],
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const onCommitFootprintEdit = !isLocked
    ? objectWorkbenchActions.commitHouseFormFootprintDimension
    : undefined;
  const onCommitRoofIntent = !isLocked ? objectWorkbenchActions.commitHouseFormRoofIntent : undefined;
  const onAddDeck = !isLocked ? objectWorkbenchActions.addSharedHouseDeck : undefined;
  const onAddOpening = !isLocked ? objectWorkbenchActions.addSharedHouseOpening : undefined;
  const onRemoveDeck = !isLocked ? objectWorkbenchActions.removeSharedHouseDeck : undefined;
  const onRemoveOpening = !isLocked ? objectWorkbenchActions.removeSharedHouseOpening : undefined;
  const onCommitDeckPatch = !isLocked
    ? objectWorkbenchActions.commitSharedHouseDeckPatch
    : undefined;
  const onCommitOpeningPatch = !isLocked
    ? objectWorkbenchActions.commitSharedHouseOpeningPatch
    : undefined;
  const onStartDeckOutline = !isLocked
    ? objectSelectionActions.startDeckOutlineEditor
    : undefined;
  const canEditFootprint = Boolean(
    store.derived.railModel.selectedInspector.hasSelection,
  );
  const selectedHouseFormIdForRoofCommit =
    store.ui.activeObjectRef.family === 'house_forms'
      ? store.ui.activeObjectRef.objectId ?? null
      : null;

  const runFootprintCommit = useCallback<RunFootprintCommit>(
    async (fieldId, edit) => {
      const result = await resolveCommitResult(onCommitFootprintEdit?.(edit));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the house form footprint.',
      }));
    },
    [onCommitFootprintEdit],
  );

  const runRoofCommit = useCallback<RunRoofCommit>(
    async (fieldId, nextRoof) => {
      const result = await resolveCommitResult(
        selectedHouseFormIdForRoofCommit
          ? onCommitRoofIntent?.({
              houseFormId: selectedHouseFormIdForRoofCommit,
              roof: nextRoof,
            })
          : { ok: false, error: 'Select a house form before editing its roof.' },
      );
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update this house form roof.',
      }));
    },
    [onCommitRoofIntent, selectedHouseFormIdForRoofCommit],
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

  // PR-W3d.4 (2026-05-25): the right inspector derives its family directly
  // from the workbench's active object selection (`ui.activeObjectRef.family`).
  // The old `activeRailTab` is no longer the source of truth — PR-W3d.3
  // removed the tab strip entirely, so the rail no longer dispatches
  // `selectRailTab`. Selection itself (row click in the flat tree) carries
  // the family signal through `activeObjectRef.family`.
  //
  // Diagnostics is locked out of the rail (option a). Future access lands
  // in the top-bar `…` menu; this host doesn't render the diagnostics
  // panel — when Diagnostics gets a new entry point, re-add the
  // `WorkbenchDiagnosticsPanel` import and switch on a dedicated UI flag.
  const activeFamily = store.ui.activeObjectRef.family;
  const activeObjectKey = `${activeFamily}:${store.ui.activeObjectRef.objectId ?? 'none'}`;

  if (activeFamily === 'house_forms') {
    // PR-T7 (2026-05-29): renamed prop attachmentContextPanel → dimensionsPanel
    // to reflect what it actually contains after the cull (eave / wall /
    // soffit / fascia / gutter / overhang dimensions, not attachment
    // context). The duplicate "Attachment Context" outer wrapper in
    // HouseFormInspector went away, so the embedded rail's own section
    // title now reads cleanly inside the DIMENSIONS bin.
    const activeHouseFormId = store.ui.activeObjectRef.objectId ?? null;
    const canRemoveActiveHouseForm =
      !isLocked &&
      typeof activeHouseFormId === 'string';
    return (
      <div data-active-workbench-object={activeObjectKey}>
        <HouseFormInspector
          hasSelection={store.derived.railModel.selectedInspector.hasSelection}
          emptyTitle={store.derived.railModel.selectedInspector.emptyTitle}
          emptyMessage={store.derived.railModel.selectedInspector.emptyMessage}
          houseFormContext={store.derived.objectWorkbench.houseForm}
          disabled={isLocked}
          fieldErrors={fieldErrors}
          canEditFootprint={canEditFootprint}
          runFootprintCommit={runFootprintCommit}
          runRoofCommit={runRoofCommit}
          dimensionsPanel={null}
        />
        {canRemoveActiveHouseForm && activeHouseFormId ? (
          <section className={workbenchRailStyles.section}>
            <div className={workbenchRailStyles.sectionBody}>
              <button
                type="button"
                className={workbenchRailStyles.dangerButton}
                onClick={() => {
                  void objectWorkbenchActions.removeSharedHouseForm({
                    houseFormId: activeHouseFormId,
                  });
                }}
              >
                Remove this house form
              </button>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (activeFamily === 'pergolas') {
    if (!store.derived.railModel.selectedInspector.hasSelection) {
      return (
        <section className={workbenchRailStyles.section}>
          <h4 className={workbenchRailStyles.sectionTitle}>
            {store.derived.railModel.selectedInspector.emptyTitle}
          </h4>
          <div className={workbenchRailStyles.sectionBody}>
            <p className={workbenchRailStyles.empty}>
              {store.derived.railModel.selectedInspector.emptyMessage}
            </p>
          </div>
        </section>
      );
    }
    const pergolaOptions = store.derived.solvedProject.pergolas.map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
    }));
    return (
      <div data-active-workbench-object={activeObjectKey}>
        <PergolaInspector
          activePergolaModel={activePergolaModel}
          activePergolaId={store.derived.activePergola?.id ?? store.ui.activePergolaId}
          disabled={isLocked}
          pergolaOptions={pergolaOptions}
          onOpenHouseForms={() => handleRailTabSelect('house_forms')}
          onSelectPergola={handleCanonicalPergolaSelection}
          onCommitAttachment={!isLocked ? objectWorkbenchActions.commitSharedPergolaAttachment : undefined}
        />
      </div>
    );
  }

  if (activeFamily === 'decks') {
    return (
      <div data-active-workbench-object={activeObjectKey}>
        <DeckInspector
          activeDeck={store.derived.objectWorkbench.activeDeck}
          disabled={isLocked}
          fieldErrors={fieldErrors}
          onAddDeck={onAddDeck}
          onCommitDeckPatch={onCommitDeckPatch}
          onRemoveDeck={onRemoveDeck}
          onStartDeckOutline={onStartDeckOutline}
          runAction={runInspectorAction}
        />
      </div>
    );
  }

  // activeFamily === 'openings'
  return (
    <div data-active-workbench-object={activeObjectKey}>
      <OpeningInspector
        activeOpening={store.derived.objectWorkbench.activeOpening}
        disabled={isLocked}
        fieldErrors={fieldErrors}
        onAddOpening={onAddOpening}
        onCommitOpeningPatch={onCommitOpeningPatch}
        onRemoveOpening={onRemoveOpening}
        runAction={runInspectorAction}
      />
    </div>
  );
}
