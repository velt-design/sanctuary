'use client';

import type { WorkbenchViewStatus } from '@/lib/drawings/workbenchViewTypes';
import EstimateDrawingSheet from '@/components/estimates/EstimateDrawingSheet';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';

export type SheetComposerDocument = {
  sheetLabel: string;
  status: WorkbenchViewStatus;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  meta: EstimateDrawingSheetMeta;
};

export default function SheetComposer({ document }: { document: SheetComposerDocument }) {
  return (
    <EstimateDrawingSheet
      sheetLabel={document.sheetLabel}
      view="plan"
      status={document.status}
      drawingSurfaceGeometry={document.drawingSurfaceGeometry}
      meta={document.meta}
    />
  );
}
