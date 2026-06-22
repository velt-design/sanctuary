'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import DeckInspector from '@/components/drawings/rail/DeckInspector';
import HouseFormInspector from '@/components/drawings/rail/HouseFormInspector';
import OpeningInspector from '@/components/drawings/rail/OpeningInspector';
import { resolveCommitResult } from '@/components/drawings/rail/objectRailShared';
import type {
  RunAction,
  RunRoofCommit,
} from '@/components/drawings/rail/objectWorkbenchRailTypes';
import workbenchRailStyles from '@/components/drawings/rail/WorkbenchRail.module.css';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import type {
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildPergolaSelectionUiState } from './pergolaSelectionState';
import PergolaInspector from './PergolaInspector';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';

/*
 * Right-inspector content host.
 *
 * Mounts per-family inspector content for the active object selection while
 * ObjectWorkbenchRailHost renders navigation and visibility. Both hosts
 * consume the same store and action hooks; only their visual surfaces differ.
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
  const defaultHouseFormId =
    store.ui.activeObjectRef.family === 'house_forms' && store.ui.activeObjectRef.objectId
      ? store.ui.activeObjectRef.objectId
      : store.derived.railModel.objectLists.house_forms[0]?.ref.objectId ?? null;

  const handleOpenHouseForms = useCallback(
    () => {
      objectSelectionActions.selectObjectRef({
        family: 'house_forms',
        objectId: defaultHouseFormId,
      });
    },
    [defaultHouseFormId, objectSelectionActions],
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
  const onCommitRoofIntent = !isLocked ? objectWorkbenchActions.commitHouseFormRoofIntent : undefined;
  const onAddOpening = !isLocked ? objectWorkbenchActions.addSharedHouseOpening : undefined;
  const onRemoveDeck = !isLocked ? objectWorkbenchActions.removeSharedHouseDeck : undefined;
  const onRemoveOpening = !isLocked ? objectWorkbenchActions.removeSharedHouseOpening : undefined;
  const onCommitDeckPatch = !isLocked
    ? objectWorkbenchActions.commitSharedHouseDeckPatch
    : undefined;
  const onCommitOpeningPatch = !isLocked
    ? objectWorkbenchActions.commitSharedHouseOpeningPatch
    : undefined;
  const selectedHouseFormIdForRoofCommit =
    store.ui.activeObjectRef.family === 'house_forms'
      ? store.ui.activeObjectRef.objectId ?? null
      : null;

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

  // The right inspector derives its family from the canonical active object
  // selection (`ui.activeObjectRef.family`).
  //
  // Diagnostics is locked out of the rail (option a). Future access lands
  // in the top-bar menu; this host doesn't render diagnostics today.
  // When Diagnostics gets a new entry point, add a dedicated panel and
  // switch on a dedicated UI flag.
  const activeFamily = store.ui.activeObjectRef.family;
  const activeObjectKey = `${activeFamily}:${store.ui.activeObjectRef.objectId ?? 'none'}`;

  if (activeFamily === 'house_forms') {
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
          onOpenHouseForms={handleOpenHouseForms}
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
          onCommitDeckPatch={onCommitDeckPatch}
          onRemoveDeck={onRemoveDeck}
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
