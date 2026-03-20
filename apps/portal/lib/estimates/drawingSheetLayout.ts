import type { EstimateDrawingFixedScaleValue } from './drawingSheet';

export const A3_LANDSCAPE_MM = {
  width: 420,
  height: 297,
} as const;

export const DRAWING_SHEET_VIEWBOX = {
  width: 120,
  height: 90,
} as const;

export const DRAWING_SHEET_DRAWING_VIEWPORT_MM = {
  width: 288,
  height: 216,
} as const;

export type DrawingSheetFitResult = {
  fits: boolean;
  requiredWidthMm: number;
  requiredHeightMm: number;
  availableWidthMm: number;
  availableHeightMm: number;
};

export type DrawingSheetReservedMarginsMm = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function getDrawingSheetViewportMm(): { widthMm: number; heightMm: number } {
  return {
    widthMm: DRAWING_SHEET_DRAWING_VIEWPORT_MM.width,
    heightMm: DRAWING_SHEET_DRAWING_VIEWPORT_MM.height,
  };
}

export function getViewBoxUnitsPerMm(viewportMm?: { widthMm: number; heightMm: number }): number {
  const viewport = viewportMm ?? getDrawingSheetViewportMm();
  return DRAWING_SHEET_VIEWBOX.width / viewport.widthMm;
}

export function convertMmToViewBox(mm: number, viewportMm?: { widthMm: number; heightMm: number }): number {
  return mm * getViewBoxUnitsPerMm(viewportMm);
}

export function convertMetresToPaperMm(valueM: number, ratio: EstimateDrawingFixedScaleValue): number {
  return (valueM * 1000) / ratio;
}

export function getViewBoxUnitsPerMetreAtScale(
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): number {
  return convertMetresToPaperMm(1, ratio) * getViewBoxUnitsPerMm(viewportMm);
}

export function evaluateDrawingSheetFit(input: {
  widthM: number;
  heightM: number;
  ratio: EstimateDrawingFixedScaleValue;
  marginsMm: DrawingSheetReservedMarginsMm;
  viewportMm?: { widthMm: number; heightMm: number };
}): DrawingSheetFitResult {
  const viewport = input.viewportMm ?? getDrawingSheetViewportMm();
  const requiredWidthMm = convertMetresToPaperMm(input.widthM, input.ratio) + input.marginsMm.left + input.marginsMm.right;
  const requiredHeightMm = convertMetresToPaperMm(input.heightM, input.ratio) + input.marginsMm.top + input.marginsMm.bottom;

  return {
    fits: requiredWidthMm <= viewport.widthMm + 1e-6 && requiredHeightMm <= viewport.heightMm + 1e-6,
    requiredWidthMm,
    requiredHeightMm,
    availableWidthMm: viewport.widthMm,
    availableHeightMm: viewport.heightMm,
  };
}
