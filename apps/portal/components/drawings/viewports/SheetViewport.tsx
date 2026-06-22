'use client';

import type { WorkbenchViewStatus } from '@/lib/drawings/workbenchViewTypes';
import type { WorkbenchDrawingSurfaceGeometry } from '@/lib/drawings/views/workbenchDrawingSurfaceGeometry';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import SheetComposer, { type SheetComposerDocument } from '@/components/drawings/sheets/SheetComposer';
import styles from './SheetViewport.module.css';

export default function SheetViewport({
  sheetLabel,
  status,
  drawingSurfaceGeometry,
  meta,
}: {
  sheetLabel: string;
  status: WorkbenchViewStatus;
  drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null;
  meta: EstimateDrawingSheetMeta;
}) {
  const document: SheetComposerDocument = {
    sheetLabel,
    status,
    drawingSurfaceGeometry,
    meta,
  };

  return (
    <div className={styles.viewport}>
      <SheetComposer document={document} />
    </div>
  );
}
