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
import type { ObjectWorkbenchGeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import type {
  DrawingWorkbenchRailTab,
  DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import HouseFormAttachmentContextPanel from './HouseFormAttachmentContextPanel';
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
 * After PR-W3d retires the legacy per-object input rails entirely, this
 * host is the only consumer of those inspector components; the rail's
 * inspector slot disappears.
 */

type WorkbenchInspectorHostProps = {
  activeModuleInput: CalculatorModuleInputs | null;
  geometryEditState: ObjectWorkbenchGeometryEditState | null;
  isLocked: boolean;
  objectSelectionActions: ObjectWorkbenchSelectionActions;
  objectWorkbenchActions: ObjectWorkbenchActions;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  store: DrawingWorkbenchStore;
  supportsSanctuaryEditing: boolean;
};

export default function WorkbenchInspectorHost({
  activeModuleInput,
  geometryEditState,
  isLocked,
  objectSelectionActions,
  objectWorkbenchActions,
  setUi,
  store,
  supportsSanctuaryEditing,
}: WorkbenchInspectorHostProps) {
  const activePergolaModel =
    store.derived.objectWorkbench.activePergola ??
    store.derived.objectWorkbench.pergolas[0] ??
    null;
  const defaultPergolaId =
    store.ui.activeObjectFamily === 'pergolas' && store.ui.activeObjectRef.objectId
      ? store.ui.activeObjectRef.objectId
      : store.derived.objectWorkbench.activePergola?.id ??
        activeModuleInput?.pergolaId ??
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
  const onCommitRoofIntent = !isLocked ? objectWorkbenchActions.commitSharedHouseRoofDraft : undefined;
  const onStartDrawOutline = objectSelectionActions.startDrawOutlineEditor;
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
    store.derived.activeModule?.assemblyModel.capabilities.canEditHouseFootprint,
  );
  const canStartDrawOutline = !isLocked;

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

  const runStartOutline = useCallback(async () => {
    const result = await resolveCommitResult(onStartDrawOutline?.());
    setFieldErrors((current) => ({
      ...current,
      outline: result.ok ? '' : result.error ?? 'Unable to start outline drawing.',
    }));
  }, [onStartDrawOutline]);

  const runRoofCommit = useCallback<RunRoofCommit>(
    async (fieldId, nextRoof) => {
      const result = await resolveCommitResult(onCommitRoofIntent?.(nextRoof));
      setFieldErrors((current) => ({
        ...current,
        [fieldId]: result.ok ? '' : result.error ?? 'Unable to update the shared house roof.',
      }));
    },
    [onCommitRoofIntent],
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
    const dimensionsPanel =
      supportsSanctuaryEditing && activeModuleInput ? (
        <HouseFormAttachmentContextPanel
          moduleLabel={store.derived.activeModuleLabel}
          geometryState={geometryEditState}
          view={store.ui.activeView}
          disabled={isLocked}
          canStartDrawOutline={!isLocked}
          onStartDrawOutline={objectSelectionActions.startDrawOutlineEditor}
          onCommitGeometryEdit={!isLocked ? objectWorkbenchActions.commitGeometryIntent : undefined}
        />
      ) : null;
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
          canStartDrawOutline={canStartDrawOutline}
          runFootprintCommit={runFootprintCommit}
          runStartOutline={runStartOutline}
          runRoofCommit={runRoofCommit}
          dimensionsPanel={dimensionsPanel}
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
    const pergolaInspectorModules = store.persisted.modules.map((module) => ({
      id: module.drawingModule.input.pergolaId ?? module.id,
      label: module.label,
    }));
    const perObjectPergolaOptions = store.derived.solvedProject.pergolas.map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
    }));
    return (
      <div data-active-workbench-object={activeObjectKey}>
        <PergolaInspector
          activePergolaModel={activePergolaModel}
          activeModuleInput={activeModuleInput}
          activeModuleLabel={store.derived.activeModuleLabel}
          activePergolaId={store.derived.activePergola?.id ?? store.ui.activePergolaId}
          disabled={isLocked}
          geometryState={geometryEditState}
          houseAssembly={store.derived.houseAssembly}
          modules={perObjectPergolaOptions.length ? perObjectPergolaOptions : pergolaInspectorModules}
          supportsSanctuaryEditing={supportsSanctuaryEditing}
          view={store.ui.activeView}
          onOpenHouseForms={() => handleRailTabSelect('house_forms')}
          onSelectPergola={handleCanonicalPergolaSelection}
          onStartDrawOutline={objectSelectionActions.startDrawOutlineEditor}
          onCommitGeometryEdit={!isLocked ? objectWorkbenchActions.commitGeometryIntent : undefined}
          onCommitAttachment={!isLocked ? objectWorkbenchActions.commitSharedPergolaAttachment : undefined}
          activeAssembly={store.derived.activeModule?.solution?.geometryArtifact?.assembly ?? null}
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
