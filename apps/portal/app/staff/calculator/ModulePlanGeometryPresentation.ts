import styles from './CalculatorGrid.module.css';
import type { ModuleDrawingPresentation } from './ModuleDrawingContracts';
import type { ModulePlanModel } from './moduleViews';
import { type Point } from './ModuleDrawingSurfacePrimitives';

export type PlanFitBox = {
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};

export function resolvePlanFitBox(totalW: number, totalH: number, presentation: ModuleDrawingPresentation, isHipCorner: boolean): PlanFitBox {
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  if (presentation === 'sheet') {
    const maxW = 120;
    const maxH = 90;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    const slackY = Math.max(0, maxH - heightPx);
    return {
      x: (maxW - widthPx) / 2,
      y: slackY * 0.5,
      scale,
      houseBandHeight: 5.3,
      houseBandOffset: 1.15,
      houseInset: 1.7,
      fallGap: 5.0,
    };
  }

  if (presentation === 'model') {
    const maxW = 92;
    const maxH = 64;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    return {
      x: 14 + (maxW - widthPx) / 2,
      y: 11 + (maxH - heightPx) / 2,
      scale,
      houseBandHeight: 10,
      houseBandOffset: 2.1,
      houseInset: 2.4,
      fallGap: 7,
    };
  }

  const maxW = 74;
  const maxH = 42;
  const scale = Math.min(maxW / safeW, maxH / safeH);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  return {
    x: 23 + (maxW - widthPx) / 2,
    y: 20 + (maxH - heightPx) / 2,
    scale,
    houseBandHeight: 8,
    houseBandOffset: 2,
    houseInset: 2,
    fallGap: 8,
  };
}

export function getPlanRealExtents(model: ModulePlanModel): { widthM: number; heightM: number } {
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const xValues = [0, model.roofType === 'hip_corner' ? Math.max(model.lengthA, model.lengthB ?? 0) : model.lengthA, ...housePoints.map((point) => point.x)];
  const yValues = [0, model.roofType === 'hip_corner' ? model.spanA + (model.spanB ?? 0) : model.spanA, ...housePoints.map((point) => point.y)];
  const widthM = Math.max(...xValues) - Math.min(...xValues);
  const heightM = Math.max(...yValues) - Math.min(...yValues);
  if (model.roofType === 'hip_corner' || model.drawingRotationQuarterTurns % 2 === 0) {
    return { widthM, heightM };
  }
  return { widthM: heightM, heightM: widthM };
}

export function hipCornerInnerPoints(x: number, y: number, aW: number, bW: number, splitY: number, bottomY: number, inset: number): Point[] {
  const t = Math.max(0.2, inset);
  return [
    { x: x + t, y: y + t },
    { x: x + aW - t, y: y + t },
    { x: x + aW - t, y: splitY - t },
    { x: x + bW - t, y: splitY - t },
    { x: x + bW - t, y: bottomY - t },
    { x: x + t, y: bottomY - t },
  ];
}

export function projectLinearPositions(positionsM: number[] | null, lengthM: number | null, startX: number, drawWidth: number): number[] {
  if (!positionsM || !positionsM.length || !lengthM || lengthM <= 0) return [];
  return positionsM.map((posM) => startX + (Math.max(0, posM) / lengthM) * drawWidth);
}

export function interiorPlanRafterXs(xs: number[]): number[] {
  if (xs.length <= 2) return [];
  return xs.slice(1, -1);
}

export function planHousePointToSvg(
  point: Point,
  baseX: number,
  baseY: number,
  scale: number,
): Point {
  return {
    x: baseX + point.x * scale,
    y: baseY + point.y * scale,
  };
}

export function planRotationTurnsForPresentation(input: {
  roofType: ModulePlanModel['roofType'];
  drawingRotationQuarterTurns: ModulePlanModel['drawingRotationQuarterTurns'];
  presentation: ModuleDrawingPresentation;
}): number {
  if (input.roofType === 'hip_corner') return 0;
  if (input.presentation === 'model') return 0;
  return input.drawingRotationQuarterTurns;
}

export function planHouseSurfaceClass(kind: NonNullable<ModulePlanModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
}

export function planHouseLineClass(kind: NonNullable<ModulePlanModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseAttachmentTarget}`;
  return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseWallSemantic}`;
}

export function resolvePlanRotationFrame(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  turns: number;
}): { baseX: number; baseY: number; center: Point; turns: number } {
  const turns = ((input.turns % 4) + 4) % 4;
  if (turns % 2 === 0) {
    return {
      baseX: input.x,
      baseY: input.y,
      center: { x: input.x + input.width / 2, y: input.y + input.height / 2 },
      turns,
    };
  }

  const delta = (input.width - input.height) / 2;
  const baseX = input.x - delta;
  const baseY = input.y + delta;
  return {
    baseX,
    baseY,
    center: { x: baseX + input.width / 2, y: baseY + input.height / 2 },
    turns,
  };
}
