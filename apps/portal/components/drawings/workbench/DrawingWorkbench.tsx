'use client';

import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit, EstimateDrawingModuleFieldEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { DrawingWorkbenchViewportMode, DrawingWorkbenchViewportTransform } from '@/lib/drawings/state/drawingWorkbenchUiState';
import SheetViewport from '@/components/drawings/viewports/SheetViewport';
import ModelSpaceViewport from '@/components/drawings/viewports/ModelSpaceViewport';
import ConfiguratorRail from '@/components/drawings/rail/ConfiguratorRail';
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
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  activeModuleInput?: CalculatorModuleInputs | null;
  planViewModel?: PlanViewModel | null;
  viewportTransform: DrawingWorkbenchViewportTransform;
  onViewportTransformChange: (transform: DrawingWorkbenchViewportTransform) => void;
  meta: EstimateDrawingSheetMeta;
  editableFields?: EstimateDrawingField[];
  showDebugOverlays?: boolean;
  isEstimateLocked?: boolean;
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitModuleField?: (
    edit: EstimateDrawingModuleFieldEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onOpenFullCalculator?: () => void;
};

export default function DrawingWorkbench({
  moduleLabel,
  modules,
  activeModuleIndex,
  onActiveModuleIndexChange,
  view,
  onViewChange,
  viewportMode,
  onViewportModeChange,
  status,
  planModel,
  sectionModel,
  activeModuleInput,
  planViewModel,
  viewportTransform,
  onViewportTransformChange,
  meta,
  editableFields,
  showDebugOverlays,
  isEstimateLocked,
  onCommitField,
  onCommitFootprintEdit,
  onCommitModuleField,
  onOpenFullCalculator,
}: DrawingWorkbenchProps) {
  return (
    <section className={styles.workbench} aria-label="Drawing workbench">
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <div className={styles.toolbarMeta}>
            <p className={styles.eyebrow}>Drawing Workbench</p>
            <h3 className={styles.title}>{moduleLabel}</h3>
          </div>
          {modules.length > 1 ? (
            <label className={styles.toolbarField}>
              <span className={styles.eyebrow}>Module</span>
              <select
                className={styles.toolbarSelect}
                aria-label="Drawing module"
                value={String(activeModuleIndex)}
                onChange={(event) => onActiveModuleIndexChange(Number(event.target.value))}
              >
                {modules.map((module, index) => (
                  <option key={module.id} value={String(index)}>
                    {module.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.toolbarGroup}>
          <ViewportModeSwitch value={viewportMode} onChange={onViewportModeChange} />
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
        </div>
      </div>

      <div className={styles.shell}>
        <aside className={styles.rail}>
          <ConfiguratorRail
            moduleLabel={moduleLabel}
            moduleInput={activeModuleInput}
            view={view}
            editableFields={editableFields}
            onCommitField={onCommitField}
            onCommitFootprintEdit={onCommitFootprintEdit}
            onCommitModuleField={onCommitModuleField}
            onOpenFullCalculator={onOpenFullCalculator}
            disabled={isEstimateLocked}
          />
        </aside>

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
          ) : (
            <ModelSpaceViewport
              view={view}
              status={status}
              planModel={planModel}
              sectionModel={sectionModel}
              planViewModel={planViewModel}
              viewportTransform={viewportTransform}
              onViewportTransformChange={onViewportTransformChange}
              onCommitFootprintEdit={onCommitFootprintEdit}
            />
          )}
        </div>
      </div>
    </section>
  );
}
