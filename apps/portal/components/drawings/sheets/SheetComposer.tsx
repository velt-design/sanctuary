'use client';

import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import EstimateDrawingSheet from '@/components/estimates/EstimateDrawingSheet';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';

export type SheetComposerDocument = {
  moduleLabel: string;
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  planViewModel?: PlanViewModel | null;
  meta: EstimateDrawingSheetMeta;
  editableFields?: EstimateDrawingField[];
  showDebugOverlays?: boolean;
  onCommitField?: (
    field: EstimateDrawingField,
    nextValue: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onCommitFootprintEdit?: (
    edit: EstimateDrawingFootprintEdit,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
};

export default function SheetComposer({ document }: { document: SheetComposerDocument }) {
  return (
    <EstimateDrawingSheet
      moduleLabel={document.moduleLabel}
      view={document.view}
      status={document.status}
      drawingSurfaceGeometry={document.drawingSurfaceGeometry}
      planViewModel={document.planViewModel}
      meta={document.meta}
      editableFields={document.editableFields}
      showDebugOverlays={document.showDebugOverlays}
      onCommitField={document.onCommitField}
      onCommitFootprintEdit={document.onCommitFootprintEdit}
    />
  );
}
