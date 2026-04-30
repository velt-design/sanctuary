'use client';

import Link from 'next/link';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { ObjectWorkbenchGeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { DeckInteractionTelemetry } from '@/lib/drawings/interactions/deckInteractionContract';
import type {
  DrawingWorkbenchViewportMode,
  DrawingWorkbenchViewportTransform,
  DrawingWorkbenchVisibilityState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { CalculatorHouseFootprintPolygonPoint } from '@/lib/types/calculator';
import type {
  ObjectWorkbenchDeckPatch,
  ObjectWorkbenchDisplayFamily,
  ObjectWorkbenchOpeningPatch,
  ObjectWorkbenchViewportTargetSelection,
} from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import SheetViewport from '@/components/drawings/viewports/SheetViewport';
import ModelSpaceViewport from '@/components/drawings/viewports/ModelSpaceViewport';
import Geometry3DViewport, {
  type Geometry3DViewportState,
} from '@/components/drawings/viewports/Geometry3DViewport';
import ViewportModeSwitch from './ViewportModeSwitch';
import styles from './DrawingWorkbench.module.css';

const VIEW_OPTIONS: Array<{ id: ModuleViewsTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'section', label: 'Section' },
];

type DrawingWorkbenchProps = {
  moduleLabel: string;
  modules: Array<{ id: string; label: string }>;
  activeModuleIndex: number;
  onActiveModuleIndexChange: (index: number) => void;
  view: ModuleViewsTab;
  onViewChange: (view: ModuleViewsTab) => void;
  viewportMode: DrawingWorkbenchViewportMode;
  objectWorkbenchDisplayFamily?: ObjectWorkbenchDisplayFamily;
  visibility?: DrawingWorkbenchVisibilityState;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  availableViewportModes?: DrawingWorkbenchViewportMode[];
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  planViewModel?: PlanViewModel | null;
  geometryPreview?: ObjectWorkbenchGeometryPreviewState | null;
  activeObjectRef?: WorkbenchObjectRef | null;
  modelViewportKey?: string;
  modelViewportTransform: DrawingWorkbenchViewportTransform;
  modelViewportAutoFitOnReady?: boolean;
  geometryViewportKey?: string;
  geometryViewportState?: Geometry3DViewportState | null;
  drawOutlineRequestId?: number;
  drawOutlineMode?: 'footprint' | 'deck' | null;
  drawOutlineSeedPolygon?: CalculatorHouseFootprintPolygonPoint[];
  onDrawOutlineRequestConsumed?: (requestId: number) => void;
  onModelViewportTransformChange: (transform: DrawingWorkbenchViewportTransform) => void;
  onGeometryViewportStateChange?: (state: Geometry3DViewportState) => void;
  meta: EstimateDrawingSheetMeta;
  backHref?: string;
  editableFields?: EstimateDrawingField[];
  modelEditableFields?: EstimateDrawingField[];
  showDebugOverlays?: boolean;
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitModelField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitCustomPolygon?: (
    polygon: CalculatorHouseFootprintPolygonPoint[],
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  onCommitHouseFormFootprintDimension?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitDeckDimension?: (
    deckId: string,
    patch: ObjectWorkbenchDeckPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitOpeningDimension?: (
    openingId: string,
    patch: ObjectWorkbenchOpeningPatch,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onDeckInteractionTelemetryChange?: (telemetry: DeckInteractionTelemetry) => void;
};

export default function DrawingWorkbench({
  moduleLabel,
  modules,
  activeModuleIndex,
  onActiveModuleIndexChange,
  view,
  onViewChange,
  viewportMode,
  objectWorkbenchDisplayFamily = 'pergolas',
  visibility,
  onViewportModeChange,
  availableViewportModes,
  status,
  planModel,
  sectionModel,
  planViewModel,
  geometryPreview,
  activeObjectRef,
  modelViewportKey,
  modelViewportTransform,
  modelViewportAutoFitOnReady = true,
  geometryViewportKey,
  geometryViewportState,
  drawOutlineRequestId,
  drawOutlineMode,
  drawOutlineSeedPolygon,
  onDrawOutlineRequestConsumed,
  onModelViewportTransformChange,
  onGeometryViewportStateChange,
  meta,
  backHref,
  editableFields,
  modelEditableFields,
  showDebugOverlays,
  onCommitField,
  onCommitModelField,
  onCommitFootprintEdit,
  onCommitCustomPolygon,
  onSelectObjectWorkbenchTarget,
  onSelectPergolaTarget,
  onClearWorkbenchSelection,
  onCommitHouseFormFootprintDimension,
  onCommitDeckDimension,
  onCommitOpeningDimension,
  onDeckInteractionTelemetryChange,
}: DrawingWorkbenchProps) {
  void moduleLabel;
  void modules;
  void activeModuleIndex;
  void onActiveModuleIndexChange;

  return (
    <section className={styles.workbench} aria-label="Drawing workbench">
      <div className={styles.toolbar}>
        <nav className={styles.toolbarNav} aria-label="Drawing workbench controls">
          <ViewportModeSwitch
            value={viewportMode}
            onChange={onViewportModeChange}
            availableModes={availableViewportModes}
          />
          {backHref ? (
            <Link href={backHref} className={styles.toolbarLink}>
              Back to Project
            </Link>
          ) : null}
          <div className={styles.toggleGroup} role="tablist" aria-label="Drawing view">
            {VIEW_OPTIONS.map((option) => {
              const active = option.id === view;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
                  onClick={() => onViewChange(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <div className={styles.viewport}>
        {viewportMode === 'sheet' ? (
          <SheetViewport
            moduleLabel={moduleLabel}
            view={view}
            status={status}
            planModel={planModel}
            sectionModel={sectionModel}
            meta={meta}
            editableFields={editableFields}
            showDebugOverlays={showDebugOverlays}
            onCommitField={onCommitField}
            onCommitFootprintEdit={onCommitFootprintEdit}
          />
        ) : viewportMode === 'model' ? (
          <ModelSpaceViewport
            view={view}
            objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
            visibility={visibility}
            status={status}
            planModel={planModel}
            sectionModel={sectionModel}
            planViewModel={planViewModel}
            activeObjectRef={activeObjectRef}
            drawOutlineRequestId={drawOutlineRequestId}
            drawOutlineMode={drawOutlineMode}
            drawOutlineSeedPolygon={drawOutlineSeedPolygon}
            onConsumeDrawOutlineRequest={onDrawOutlineRequestConsumed}
            fitViewKey={modelViewportKey ?? `${activeModuleIndex}:${view}`}
            autoFitOnReady={modelViewportAutoFitOnReady}
            viewportTransform={modelViewportTransform}
            onViewportTransformChange={onModelViewportTransformChange}
            editableFields={modelEditableFields}
            onCommitField={onCommitModelField}
            onCommitFootprintEdit={onCommitFootprintEdit}
            onCommitCustomPolygon={onCommitCustomPolygon}
            onSelectObjectWorkbenchTarget={onSelectObjectWorkbenchTarget}
            onSelectPergolaTarget={onSelectPergolaTarget}
            onClearWorkbenchSelection={onClearWorkbenchSelection}
            onCommitHouseFormFootprintDimension={onCommitHouseFormFootprintDimension}
            onCommitDeckDimension={onCommitDeckDimension}
            onCommitOpeningDimension={onCommitOpeningDimension}
            onDeckInteractionTelemetryChange={onDeckInteractionTelemetryChange}
          />
        ) : (
          <Geometry3DViewport
            geometryPreview={geometryPreview}
            objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
            visibility={visibility}
            viewportKey={geometryViewportKey ?? `${objectWorkbenchDisplayFamily}:${activeModuleIndex}`}
            viewportState={geometryViewportState}
            onViewportStateChange={onGeometryViewportStateChange}
          />
        )}
      </div>
    </section>
  );
}
