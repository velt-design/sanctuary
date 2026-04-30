'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import ObjectWorkbenchRail from '@/components/drawings/rail/ObjectWorkbenchRail';
import type { ObjectWorkbenchGeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import type { ObjectWorkbenchGeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import type { DrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
  deriveDrawingWorkbenchCompatibilitySelection,
  type DrawingWorkbenchRailTab,
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import HouseFormAttachmentContextPanel from './HouseFormAttachmentContextPanel';
import type { ObjectWorkbenchActions } from './useObjectWorkbenchActions';
import type { ObjectWorkbenchSelectionActions } from './useObjectWorkbenchSelection';
import PergolaInspector from './PergolaInspector';
import WorkbenchDiagnosticsPanel from './WorkbenchDiagnosticsPanel';

type ObjectWorkbenchRailHostProps = {
  activeModuleInput: CalculatorModuleInputs | null;
  geometryEditState: ObjectWorkbenchGeometryEditState | null;
  geometryPreview: ObjectWorkbenchGeometryPreviewState;
  isLocked: boolean;
  objectSelectionActions: ObjectWorkbenchSelectionActions;
  objectWorkbenchActions: ObjectWorkbenchActions;
  setUi: Dispatch<SetStateAction<DrawingWorkbenchUiState>>;
  store: DrawingWorkbenchStore;
  supportsSanctuaryEditing: boolean;
};

export default function ObjectWorkbenchRailHost({
  activeModuleInput,
  geometryEditState,
  geometryPreview,
  isLocked,
  objectSelectionActions,
  objectWorkbenchActions,
  setUi,
  store,
  supportsSanctuaryEditing,
}: ObjectWorkbenchRailHostProps) {
  const activePergolaModel =
    store.derived.objectWorkbench.activePergola ??
    store.derived.objectWorkbench.pergolas[0] ??
    null;
  const compatibilitySelection = deriveDrawingWorkbenchCompatibilitySelection(store.ui);
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

      setUi((current) => {
        const nextModuleIndex =
          defaultPergolaId === null
            ? current.activeModuleIndex
            : Math.max(
                0,
                store.persisted.modules.findIndex((module) => module.drawingModule.input.pergolaId === defaultPergolaId),
              );
        return {
          ...current,
          activeModuleIndex: nextModuleIndex,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: defaultPergolaId },
          }),
        };
      });
    },
    [defaultPergolaId, objectSelectionActions, setUi, store.persisted.modules],
  );

  const handleCanonicalPergolaSelection = useCallback(
    (pergolaId: string | null) => {
      setUi((current) => {
        const nextModuleIndex =
          pergolaId === null
            ? current.activeModuleIndex
            : Math.max(
                0,
                store.persisted.modules.findIndex((module) => module.drawingModule.input.pergolaId === pergolaId),
              );
        return {
          ...current,
          activeModuleIndex: nextModuleIndex,
          ...buildDrawingWorkbenchObjectSelectionState({
            activeRailTab: 'pergolas',
            activeObjectRef: { family: 'pergolas', objectId: pergolaId },
          }),
        };
      });
    },
    [setUi, store.persisted.modules],
  );

  const handleRailObjectSelect = useCallback(
    (ref: WorkbenchObjectRef) => {
      if (ref.family === 'pergolas') {
        handleCanonicalPergolaSelection(ref.objectId);
        return;
      }
      objectSelectionActions.selectObjectRef(ref);
    },
    [handleCanonicalPergolaSelection, objectSelectionActions],
  );

  const houseFormAttachmentContextPanel =
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

  const pergolaInspectorModules = store.persisted.modules.map((module) => ({
    id: module.id,
    label: module.label,
    pergolaId: module.drawingModule.input.pergolaId ?? null,
  }));

  const pergolaInspectorPanel = (
    <PergolaInspector
      activePergolaModel={activePergolaModel}
      activeModuleInput={activeModuleInput}
      activeModuleIndex={store.derived.activeModuleIndex}
      activeModuleLabel={store.derived.activeModuleLabel}
      disabled={isLocked}
      geometryState={geometryEditState}
      houseAssembly={store.derived.houseAssembly}
      modules={pergolaInspectorModules}
      supportsSanctuaryEditing={supportsSanctuaryEditing}
      view={store.ui.activeView}
      onOpenHouseForms={() => handleRailTabSelect('house_forms')}
      onSelectPergolaByModule={handleCanonicalPergolaSelection}
      onStartDrawOutline={objectSelectionActions.startDrawOutlineEditor}
      onCommitGeometryEdit={!isLocked ? objectWorkbenchActions.commitGeometryIntent : undefined}
      onCommitConnectionKind={!isLocked ? objectWorkbenchActions.commitSharedPergolaConnectionKind : undefined}
      onCommitAttachmentStrategy={!isLocked ? objectWorkbenchActions.commitSharedPergolaAttachmentStrategy : undefined}
      onCommitAttachmentEdge={!isLocked ? objectWorkbenchActions.commitSharedPergolaAttachmentEdge : undefined}
      onCommitAttachmentZone={!isLocked ? objectWorkbenchActions.commitSharedPergolaAttachmentZone : undefined}
    />
  );

  const diagnosticsPanel = (
    <WorkbenchDiagnosticsPanel
      objectWorkbench={store.derived.objectWorkbench}
      ui={store.ui}
      compatibilitySelection={compatibilitySelection}
      geometryPreview={geometryPreview}
    />
  );

  return (
    <ObjectWorkbenchRail
      model={store.derived.railModel}
      activeRailTab={store.ui.activeRailTab}
      activeObjectRef={store.ui.activeObjectRef}
      disabled={isLocked}
      visibility={store.ui.visibility}
      onSelectRailTab={handleRailTabSelect}
      onSelectObjectRef={handleRailObjectSelect}
      onVisibilityChange={(family, visible) =>
        setUi((current) => ({
          ...current,
          visibility: {
            ...current.visibility,
            [family]: visible,
          },
        }))
      }
      inspectorContext={{
        objectWorkbench: store.derived.objectWorkbench,
        canEditFootprint: Boolean(store.derived.activeModule?.assemblyModel.capabilities.canEditHouseFootprint),
        canStartDrawOutline: !isLocked,
        onStartDrawOutline: objectSelectionActions.startDrawOutlineEditor,
        onCommitFootprintEdit: !isLocked ? objectWorkbenchActions.commitSharedHouseFootprintEdit : undefined,
        onCommitRoofIntent: !isLocked ? objectWorkbenchActions.commitSharedHouseRoofDraft : undefined,
        onAddDeck: !isLocked ? objectWorkbenchActions.addSharedHouseDeck : undefined,
        onAddOpening: !isLocked ? objectWorkbenchActions.addSharedHouseOpening : undefined,
        onRemoveDeck: !isLocked ? objectWorkbenchActions.removeSharedHouseDeck : undefined,
        onRemoveOpening: !isLocked ? objectWorkbenchActions.removeSharedHouseOpening : undefined,
        onCommitDeckPatch: !isLocked ? objectWorkbenchActions.commitSharedHouseDeckPatch : undefined,
        onCommitOpeningPatch: !isLocked ? objectWorkbenchActions.commitSharedHouseOpeningPatch : undefined,
        onStartDeckOutline: !isLocked ? objectSelectionActions.startDeckOutlineEditor : undefined,
        houseFormAttachmentContextPanel,
        pergolaInspectorPanel,
        diagnosticsPanel,
      }}
    />
  );
}
