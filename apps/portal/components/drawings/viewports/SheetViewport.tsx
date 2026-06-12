'use client';

import type { WorkbenchViewStatus, WorkbenchViewTab } from '@/lib/drawings/workbenchViewTypes';
import type { PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingField, EstimateDrawingFootprintEdit } from '@/lib/estimates/drawingEdits';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import SheetComposer, { type SheetComposerDocument } from '@/components/drawings/sheets/SheetComposer';
import styles from './SheetViewport.module.css';

export default function SheetViewport({
  sheetLabel,
  view,
  status,
  drawingSurfaceGeometry,
  planViewModel,
  meta,
  editableFields,
  showDebugOverlays,
  onCommitField,
  onCommitFootprintEdit,
}: {
  sheetLabel: string;
  view: WorkbenchViewTab;
  status: WorkbenchViewStatus;
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
}) {
  const document: SheetComposerDocument = {
    sheetLabel,
    view,
    status,
    drawingSurfaceGeometry,
    planViewModel,
    meta,
    editableFields,
    showDebugOverlays,
    onCommitField,
    onCommitFootprintEdit,
  };

  return (
    <div className={styles.viewport}>
      <SheetComposer document={document} />
    </div>
  );
}
