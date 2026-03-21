'use client';

import EstimateDrawingSheet from '@/components/estimates/EstimateDrawingSheet';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';

export default function SheetViewport({
  moduleLabel,
  view,
  status,
  planModel,
  sectionModel,
  meta,
  editableFields,
  showDebugOverlays,
  onCommitField,
  onCommitFootprintEdit,
}: {
  moduleLabel: string;
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
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
}) {
  return (
    <EstimateDrawingSheet
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
  );
}
