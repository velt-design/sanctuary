import type { AttachmentSide } from '@sp/costing';
import type { GeometryTopProjectionViewModel, Vector2 } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
  type HouseFootprintHandleId,
  type HouseFootprintPoint,
  type ModulePlanModel,
  type ModuleSectionModel,
} from './moduleViews';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  getEstimateDrawingScaleOptions,
  type EstimateDrawingFixedScaleValue,
  type EstimateDrawingScale,
} from '@/lib/estimates/drawingSheet';
import {
  getDrawingSheetViewportMm,
  getViewBoxUnitsPerMetreAtScale,
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';
import type {
  GeometryConsistency,
  ModuleDrawingDisplayMode,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
  ModuleFootprintCanvasPoint,
  ModuleFootprintEditorProps,
  ModuleViewsTab,
} from './ModuleDrawingContracts';
import {
  ArrowHead,
  DebugOutline,
  FocusTarget,
  MODEL_SPACE_CSS_PX_PER_UNIT,
  MODEL_SPACE_UNITS_PER_METRE,
  MODEL_SPACE_VIEWBOX_PADDING,
  TickDimension,
  boundsFromLine,
  boundsFromPoints,
  boundsFromRect,
  boundsToPaddedRect,
  buildSheetDebugMetrics,
  clamp,
  createBounds,
  estimateArrowHeadBounds,
  estimateTextBounds,
  estimateTickDimensionBounds,
  evaluateAnnotatedSheetFit,
  fitsWithinArea,
  formatMetres,
  formatMetresPrecise,
  getBoundsHeight,
  getBoundsWidth,
  getDimensionPresentationSpec,
  getSheetDrawingField,
  insetRect,
  memberSizeM,
  rectToPoints,
  resolveBoundsPlacement,
  resolveMeasuredFitLayout,
  resolveModelSpaceFocusMetrics,
  resolveModelSpaceSvgMetrics,
  resolveModelSpaceWorldMetrics,
  rotateBoundsQuarterTurns,
  rotatePointQuarterTurns,
  rotatePointsQuarterTurns,
  segmentDownNormal,
  toPointsAttr,
  translateBounds,
  unionBounds,
  viewBoxUnitsToMm,
  type AnnotatedBounds,
  type Point,
  type ResolvedModelSpaceLayout,
  type ResolvedSheetLayout,
  type SheetDebugMetrics,
  type SheetDrawingField,
  type SheetFitArea,
  type SheetRect,
  type SvgDebugScaleProps,
} from './ModuleDrawingSurfacePrimitives';
type SectionFitFrame = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  verticalBias: number;
  annotationPadLeft: number;
  annotationPadRight: number;
  annotationPadTop: number;
  annotationPadBottom: number;
};


export function getSectionSheetFrame(sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  const outerField = getSheetDrawingField();
  return {
    outerField,
    fitArea: outerField,
    verticalBias: 0.5,
    annotationPadLeft: 0,
    annotationPadRight: 0,
    annotationPadTop: 0,
    annotationPadBottom: 0,
  };
}


export function resolveSectionFitFrame(presentation: ModuleDrawingPresentation, sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  if (presentation === 'sheet') {
    return getSectionSheetFrame(sectionKind);
  }

  if (presentation === 'model') {
    return {
      outerField: { x: 8, y: 8, width: 104, height: 74 },
      fitArea: { x: 12, y: 10, width: 96, height: 68 },
      verticalBias: 0.5,
      annotationPadLeft: 0,
      annotationPadRight: 0,
      annotationPadTop: 0,
      annotationPadBottom: 0,
    };
  }

  return {
    outerField: { x: 18, y: 16, width: 84, height: 56 },
    fitArea: { x: 27, y: 22, width: 66, height: 40 },
    verticalBias: 0.3,
    annotationPadLeft: 9,
    annotationPadRight: 9,
    annotationPadTop: 6,
    annotationPadBottom: 10,
  };
}


function getSectionRealExtents(model: ModuleSectionModel): { widthM: number; heightM: number } {
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const houseProjectionValues = housePoints.map((point) => point.x);
  const houseHeightValues = housePoints.map((point) => point.y);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionLedgerBeamDepthM(model);
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionSupportBeamDepthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportUndersideM = sectionSupportUndersideM(model);
  const supportBeamTopM = supportUndersideM + sectionSupportBeamDepthM(model);
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;

  const maxHeightM = Math.max(
    0.1,
    houseLedgerUndersideM,
    model.rightEdgeHeightM,
    supportUndersideM,
    outerGutterUndersideM,
    houseRafterUndersideM,
    supportRafterUndersideM,
    supportBeamTopM,
    outerRafterUndersideM,
    houseRafterUndersideM + model.rafterDepthM,
    outerRafterUndersideM + model.rafterDepthM,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : 0,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM + ridgeBeamDepthM + model.rafterDepthM : 0,
    ...houseHeightValues,
  );

  return {
    widthM: Math.max(model.spanA, 0.001, Math.max(model.spanA, ...houseProjectionValues) - Math.min(0, ...houseProjectionValues)),
    heightM: maxHeightM,
  };
}


export function sectionOverhangM(model: ModuleSectionModel): number {
  return model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, Math.min(model.overhangAmountM, Math.max(0, model.spanA - 0.01))) : 0;
}


export function sectionSupportXFromHouseM(model: ModuleSectionModel): number {
  const overhangM = sectionOverhangM(model);
  return model.sectionKind === 'mono' ? Math.max(0.05, model.spanA - overhangM) : model.spanA;
}


export function sectionLedgerBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamDepthM, 0.1);
}


export function sectionLedgerBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamWidthM, 0.05);
}


export function sectionSupportBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamDepthM, 0.15);
}


export function sectionSupportBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamWidthM, 0.05);
}


export function sectionRidgeBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamDepthM, 0.15);
}


export function sectionRidgeBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamWidthM, 0.05);
}


type MonoDatumResolution = {
  rightEdgeRole: 'gutter' | 'support';
  supportUndersideM: number;
  outerGutterUndersideM: number;
};


function resolveMonoDatums(model: ModuleSectionModel): MonoDatumResolution {
  const overhangM = sectionOverhangM(model);
  if (model.sectionKind !== 'mono' || overhangM <= 0) {
    return {
      rightEdgeRole: 'gutter',
      supportUndersideM: model.rightEdgeHeightM,
      outerGutterUndersideM: model.rightEdgeHeightM,
    };
  }

  const spanM = Math.max(model.spanA, 0.001);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftUndersideM = model.leftEdgeHeightM;
  const rightRawM = model.rightEdgeHeightM;
  const pitchRad = (model.pitchDeg * Math.PI) / 180;
  const fallPerM = Math.tan(pitchRad) * (model.slopeDirection === 'toward_house' ? 1 : -1);
  const expectedSupportUndersideM = leftUndersideM + fallPerM * supportXFromHouseM;
  const expectedOuterUndersideM = leftUndersideM + fallPerM * spanM;
  const errAsSupport = Math.abs(rightRawM - expectedSupportUndersideM);
  const errAsGutter = Math.abs(rightRawM - expectedOuterUndersideM);

  // Derived right post height is often the support-post underside when overhang is enabled.
  const treatRightAsSupport = errAsSupport + 0.03 < errAsGutter;
  if (treatRightAsSupport) {
    return {
      rightEdgeRole: 'support',
      supportUndersideM: rightRawM,
      outerGutterUndersideM: Math.max(0, expectedOuterUndersideM),
    };
  }

  const tSupport = clamp(supportXFromHouseM / spanM, 0, 1);
  return {
    rightEdgeRole: 'gutter',
    supportUndersideM: Math.max(0, leftUndersideM + (rightRawM - leftUndersideM) * tSupport),
    outerGutterUndersideM: rightRawM,
  };
}


export function sectionOuterGutterUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  return resolveMonoDatums(model).outerGutterUndersideM;
}


function sectionRafterBearingStartM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return 0;
  return Math.max(0, Math.min(model.spanA, sectionLedgerBeamWidthM(model)));
}


function sectionRafterBearingEndM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.spanA;
  const startM = sectionRafterBearingStartM(model);
  const endM = model.spanA - Math.max(0, Math.min(model.spanA, model.gutterWidthM));
  return Math.max(startM + 0.01, endM);
}


export function sectionRafterPlumbCutDropM(model: ModuleSectionModel): number {
  const pitchRad = (Math.max(0, Math.min(85, model.pitchDeg)) * Math.PI) / 180;
  const cosPitch = Math.max(0.12, Math.cos(pitchRad));
  return model.rafterDepthM / cosPitch;
}


export function sectionRafterCutLengthLabel(model: ModuleSectionModel): string | null {
  const explanation = model.rafterCutLengthExplanation;
  if (!explanation || explanation.status !== 'ready' || explanation.planes.length === 0) {
    return null;
  }

  if (explanation.planes.length === 1) {
    const item = explanation.planes[0]!;
    return `Rafter cut: ${formatMetresPrecise(item.cut_length_m)}${item.diagram_side === 'both' ? ' ea' : ''}`;
  }

  const house = explanation.planes.find((item) => item.diagram_side === 'left');
  const outer = explanation.planes.find((item) => item.diagram_side === 'right');
  if (!house || !outer) return null;
  if (Math.abs(house.cut_length_m - outer.cut_length_m) <= 0.001) {
    return `Rafter cut: ${formatMetresPrecise((house.cut_length_m + outer.cut_length_m) / 2)} ea`;
  }
  return `Rafter cut: House ${formatMetresPrecise(house.cut_length_m)} / Outer ${formatMetresPrecise(outer.cut_length_m)}`;
}


export function sectionRafterDimensionLabel(
  model: ModuleSectionModel,
  diagramIndex: number,
  schematicLengthM: number,
): { label: string; cutLengthM: number | null } {
  const explanation = model.rafterCutLengthExplanation;
  if (!explanation || explanation.status !== 'ready') {
    return {
      label: `Slope ${formatMetres(schematicLengthM)}`,
      cutLengthM: null,
    };
  }

  const side = diagramIndex === 0 ? 'left' : 'right';
  const plane =
    explanation.planes.find((item) => item.diagram_side === side) ??
    explanation.planes.find((item) => item.diagram_side === 'both') ??
    explanation.planes.find((item) => item.diagram_side === 'single') ??
    explanation.planes[diagramIndex];
  if (!plane) {
    return {
      label: `Slope ${formatMetres(schematicLengthM)}`,
      cutLengthM: null,
    };
  }

  return {
    label: `Cut ${formatMetresPrecise(plane.cut_length_m)}`,
    cutLengthM: plane.cut_length_m,
  };
}


export function sectionMonoRafterUndersideAtM(model: ModuleSectionModel, xFromHouseM: number): number {
  const startM = sectionRafterBearingStartM(model);
  const endM = sectionRafterBearingEndM(model);
  const runM = Math.max(0.001, endM - startM);
  const t = clamp((xFromHouseM - startM) / runM, 0, 1);
  const plumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseRafterUndersideM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model) - plumbCutDropM;
  const outerRafterUndersideM = sectionOuterGutterUndersideM(model) + model.gutterDepthM - plumbCutDropM;
  return houseRafterUndersideM + (outerRafterUndersideM - houseRafterUndersideM) * t;
}


export function sectionSupportUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  const resolved = resolveMonoDatums(model);
  const overhangM = sectionOverhangM(model);
  if (overhangM <= 0) return resolved.supportUndersideM;

  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const supportTopM = sectionMonoRafterUndersideAtM(model, supportXFromHouseM);
  const supportFromStackM = Math.max(0, supportTopM - sectionSupportBeamDepthM(model));
  return supportFromStackM;
}


function sectionMemberPolygon(x1: number, y1: number, x2: number, y2: number, depthPx: number): Point[] {
  const { nx, ny } = segmentDownNormal(x1, y1, x2, y2);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x2 + nx * depthPx, y: y2 + ny * depthPx },
    { x: x1 + nx * depthPx, y: y1 + ny * depthPx },
  ];
}


export function sectionMemberPolygonPlumbCuts(
  x1: number,
  yUnder1: number,
  x2: number,
  yUnder2: number,
  depthNormalPx: number,
): { points: Point[]; yTop1: number; yTop2: number } {
  const dx = x2 - x1;
  if (Math.abs(dx) < 1e-6) {
    const points = sectionMemberPolygon(x1, yUnder1, x2, yUnder2, depthNormalPx);
    const yTop1 = Math.min(...points.map((point) => point.y));
    const yTop2 = yTop1;
    return { points, yTop1, yTop2 };
  }
  const slope = (yUnder2 - yUnder1) / dx;
  const deltaY = depthNormalPx * Math.sqrt(1 + slope * slope);
  const yTop1 = yUnder1 - deltaY;
  const yTop2 = yUnder2 - deltaY;
  return {
    points: [
      { x: x1, y: yUnder1 },
      { x: x2, y: yUnder2 },
      { x: x2, y: yTop2 },
      { x: x1, y: yTop1 },
    ],
    yTop1,
    yTop2,
  };
}


export function sectionHousePointToSvg(point: Point, xLeft: number, yGround: number, scale: number): Point {
  return {
    x: xLeft + point.x * scale,
    y: yGround - point.y * scale,
  };
}


export function sectionHouseSurfaceClass(kind: NonNullable<ModuleSectionModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseRoof}`;
  if (kind === 'soffit') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseSoffit}`;
  if (kind === 'fascia') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseAttachmentZone}`;
  return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseWallSemantic}`;
}


export function sectionHouseLineClass(kind: NonNullable<ModuleSectionModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseAttachmentTarget}`;
  return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseReference}`;
}


function measureSectionAnnotatedBounds(input: {
  model: ModuleSectionModel;
  xLeft: number;
  yGround: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
  includeHouseContext?: boolean;
}): AnnotatedBounds {
  const { model, xLeft, yGround, scale, presentation = 'sheet' } = input;
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const includeHouseContext = input.includeHouseContext ?? true;
  const overhangM = sectionOverhangM(model);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const ledgerBeamDepthM = sectionLedgerBeamDepthM(model);
  const ledgerBeamWidthM = sectionLedgerBeamWidthM(model);
  const supportBeamDepthM = sectionSupportBeamDepthM(model);
  const supportBeamWidthM = sectionSupportBeamWidthM(model);
  const tieBeamDepthM = sectionSupportBeamDepthM(model);
  const tieBeamWidthM = sectionSupportBeamWidthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const ridgeBeamWidthM = sectionRidgeBeamWidthM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : ledgerBeamDepthM;
  const leftEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : ledgerBeamWidthM;
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : supportBeamDepthM;
  const rightEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : supportBeamWidthM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const supportUndersideM = sectionSupportUndersideM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;
  const supportBeamTopM = supportUndersideM + supportBeamDepthM;
  const postW = memberSizeM(model.postWidthM, 0.1) * scale;
  const rafterDepth = memberSizeM(model.rafterDepthM, 0.15) * scale;
  const gutterWidth = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const leftEaveDepth = leftEaveBeamDepthM * scale;
  const leftEaveWidth = leftEaveBeamWidthM * scale;
  const supportCapDepth = supportBeamDepthM * scale;
  const supportCapWidth = supportBeamWidthM * scale;
  const tieBeamDepth = tieBeamDepthM * scale;
  const kingStrutWidth = tieBeamWidthM * scale;
  const rightEaveBeamDepth = rightEaveBeamDepthM * scale;
  const rightEaveBeamWidth = rightEaveBeamWidthM * scale;
  const ridgeBeamWidth = ridgeBeamWidthM * scale;
  const xRight = xLeft + model.spanA * scale;
  const xSupport = model.sectionKind === 'mono' ? xLeft + supportXFromHouseM * scale : xRight;
  const ridgeX = (xLeft + xRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;
  const yHouseUnder = yForHeight(houseLedgerUndersideM);
  const ySupportUnder = yForHeight(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM);
  const yOuterGutterUnder = yForHeight(outerGutterUndersideM);
  const yHouseRafterUnder = yForHeight(houseRafterUndersideM);
  const yOuterRafterUnder = yForHeight(outerRafterUndersideM);
  const yOuterGutterTop = yForHeight(outerGutterUndersideM + model.gutterDepthM);
  const yRightEaveRafterUnder = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM);
  const ySupportBeamTop = yForHeight(supportBeamTopM);
  const yRidgeUnder = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;
  const yRidgeBeamTop = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM + ridgeBeamDepthM) : null;
  const tieBeamTopY = yHouseUnder;
  const tieBeamBottomY = Math.min(yGround - 0.4, tieBeamTopY + tieBeamDepth);
  const supportPostTopY = ySupportUnder;
  const supportCapTopY = ySupportBeamTop;
  const gutterTopY = yOuterGutterTop;
  const ledgerX = xLeft;
  const ledgerY = yForHeight(houseLedgerUndersideM + leftEaveBeamDepthM);
  const rightEaveX = xRight - rightEaveBeamWidth;
  const rightEaveY = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM);
  const leftPostX = xLeft;
  const secondPostX = model.sectionKind === 'mono' ? (overhangM > 0 ? xSupport - postW / 2 : xRight - postW) : xRight - postW;
  const monoRafterStartX = ledgerX + leftEaveWidth;
  const monoRafterEndX = xRight - gutterWidth;
  const gableLeftRafterStartX = ledgerX + leftEaveWidth;
  const gableRightRafterEndX = xRight - rightEaveBeamWidth;
  const leftDimX = xLeft - 9.8;
  const rightDimX = xRight + 10.6;
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = Math.max(yGround + 10.9, spanDatumY + 9.4);
  const overhangDimY = Math.max(spanAnchorRightY + 4.9, spanDimY - 5.8);
  const pitchLabelY = spanDimY + 6.2;
  const metaLabelY = pitchLabelY - 3.2;
  const roofLengthLabelGap = 1.6;
  const mainRoofNormal = segmentDownNormal(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;
  const monoRoofGeom = model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder, rafterDepth) : null;
  const gableLeftRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(gableLeftRafterStartX, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth) : null;
  const gableRightRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, gableRightRafterEndX, yRightEaveRafterUnder, rafterDepth) : null;
  const monoSupportSplice =
    model.sectionKind === 'mono' && overhangM > 0 && monoRoofGeom && monoRafterEndX - monoRafterStartX > 1e-6
      ? (() => {
          const t = clamp((xSupport - monoRafterStartX) / (monoRafterEndX - monoRafterStartX), 0, 1);
          const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
          const topStart = monoRoofGeom.points[3]!;
          const topEnd = monoRoofGeom.points[2]!;
          const yTop = topStart.y + (topEnd.y - topStart.y) * t;
          return { yTop, yUnder };
        })()
      : null;
  const semanticHouseSurfacePoints = includeHouseContext
    ? (model.houseContext?.surfaces ?? []).map((surface) => surface.boundary.map((point) => sectionHousePointToSvg(point, xLeft, yGround, scale)))
    : [];
  const semanticHouseLines = includeHouseContext
    ? (model.houseContext?.lines ?? []).map((line) => ({
        start: sectionHousePointToSvg(line.line.start, xLeft, yGround, scale),
        end: sectionHousePointToSvg(line.line.end, xLeft, yGround, scale),
      }))
    : [];
  const depthDimAlongRoof = 0.18;
  const depthDimUnderX = monoRafterStartX + (monoRafterEndX - monoRafterStartX) * depthDimAlongRoof;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * depthDimAlongRoof;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };
  const roofTopLengthDims = (() => {
    const offset = model.sectionKind === 'gable' ? 4.8 : 4.2;
    if (model.sectionKind === 'mono' && monoRoofGeom) {
      const topStart = monoRoofGeom.points[3]!;
      const topEnd = monoRoofGeom.points[2]!;
      const dimStart: Point = {
        x: topStart.x - mainRoofNormal.nx * offset,
        y: topStart.y - mainRoofNormal.ny * offset,
      };
      const dimEnd: Point = {
        x: topEnd.x - mainRoofNormal.nx * offset,
        y: topEnd.y - mainRoofNormal.ny * offset,
      };
      const lengthM = Math.hypot((topEnd.x - topStart.x) / scale, (topEnd.y - topStart.y) / scale);
      return [{ topStart, topEnd, dimStart, dimEnd, lengthM }];
    }
    if (model.sectionKind === 'gable' && gableLeftRoofGeom && gableRightRoofGeom) {
      const leftTopStart = gableLeftRoofGeom.points[3]!;
      const leftTopEnd = gableLeftRoofGeom.points[2]!;
      const rightTopStart = gableRightRoofGeom.points[3]!;
      const rightTopEnd = gableRightRoofGeom.points[2]!;
      const leftNormal = segmentDownNormal(leftTopStart.x, leftTopStart.y, leftTopEnd.x, leftTopEnd.y);
      const rightNormal = segmentDownNormal(rightTopStart.x, rightTopStart.y, rightTopEnd.x, rightTopEnd.y);
      const leftDimStart: Point = {
        x: leftTopStart.x - leftNormal.nx * offset,
        y: leftTopStart.y - leftNormal.ny * offset,
      };
      const leftDimEnd: Point = {
        x: leftTopEnd.x - leftNormal.nx * offset,
        y: leftTopEnd.y - leftNormal.ny * offset,
      };
      const rightDimStart: Point = {
        x: rightTopStart.x - rightNormal.nx * offset,
        y: rightTopStart.y - rightNormal.ny * offset,
      };
      const rightDimEnd: Point = {
        x: rightTopEnd.x - rightNormal.nx * offset,
        y: rightTopEnd.y - rightNormal.ny * offset,
      };
      const leftLengthM = Math.hypot((leftTopEnd.x - leftTopStart.x) / scale, (leftTopEnd.y - leftTopStart.y) / scale);
      const rightLengthM = Math.hypot((rightTopEnd.x - rightTopStart.x) / scale, (rightTopEnd.y - rightTopStart.y) / scale);
      return [
        { topStart: leftTopStart, topEnd: leftTopEnd, dimStart: leftDimStart, dimEnd: leftDimEnd, lengthM: leftLengthM },
        { topStart: rightTopStart, topEnd: rightTopEnd, dimStart: rightDimStart, dimEnd: rightDimEnd, lengthM: rightLengthM },
      ];
    }
    return [];
  })();
  const groundLeftX = isModel ? xLeft - 8 : Math.max(8, xLeft - 8);
  const groundRightX = isModel ? xRight + 8 : Math.min(104, xRight + 8);
  const groundLineRightX = isModel ? xRight + 8 : Math.min(112, xRight + 8);

  return unionBounds([
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    boundsFromRect(groundLeftX, yGround + 1.3, groundRightX - groundLeftX, 8),
    boundsFromLine(groundLeftX, yGround, groundLineRightX, yGround, 0.25),
    boundsFromRect(leftPostX, yHouseUnder, postW, yGround - yHouseUnder),
    boundsFromRect(secondPostX, supportPostTopY, postW, yGround - supportPostTopY),
    boundsFromRect(ledgerX, ledgerY, leftEaveWidth, leftEaveDepth),
    model.houseConnectionType === 'facade' || model.houseConnectionType === 'fascia'
      ? boundsFromLine(ledgerX - 1.1, yHouseUnder - 2.2, ledgerX - 1.1, yGround, 0.2)
      : null,
    model.houseConnectionType === 'fascia' ? boundsFromLine(ledgerX - 1.1, ledgerY - 0.9, ledgerX + leftEaveWidth, ledgerY - 0.9, 0.2) : null,
    model.houseConnectionType === 'soffit' ? boundsFromLine(ledgerX - 0.25, ledgerY - 1.25, ledgerX + leftEaveWidth, ledgerY - 1.25, 0.2) : null,
    model.sectionKind === 'mono' && overhangM > 0 ? boundsFromRect(xSupport - supportCapWidth / 2, supportCapTopY, supportCapWidth, supportCapDepth) : null,
    model.sectionKind === 'gable' ? boundsFromRect(rightEaveX, rightEaveY, rightEaveBeamWidth, rightEaveBeamDepth) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(xLeft, tieBeamTopY, Math.max(0.4, xRight - xLeft), Math.max(0.2, tieBeamBottomY - tieBeamTopY)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(ridgeX - kingStrutWidth / 2, yRidgeUnder, kingStrutWidth, Math.max(0.2, tieBeamTopY - yRidgeUnder)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromLine(ridgeX, yGround, ridgeX, yRidgeUnder, 0.2) : null,
    monoRoofGeom ? boundsFromPoints(monoRoofGeom.points, 0.35) : null,
    gableLeftRoofGeom ? boundsFromPoints(gableLeftRoofGeom.points, 0.35) : null,
    gableRightRoofGeom ? boundsFromPoints(gableRightRoofGeom.points, 0.35) : null,
    yRidgeBeamTop !== null ? boundsFromRect(ridgeX - ridgeBeamWidth / 2, yRidgeBeamTop, ridgeBeamWidth, Math.max(0.2, yRidgeUnder! - yRidgeBeamTop)) : null,
    monoSupportSplice ? boundsFromLine(xSupport, monoSupportSplice.yTop, xSupport, monoSupportSplice.yUnder, 0.2) : null,
    model.sectionKind === 'mono' ? boundsFromRect(xRight - gutterWidth, gutterTopY, gutterWidth, Math.max(0.2, yOuterGutterUnder - gutterTopY)) : null,
    ...roofTopLengthDims.flatMap((roofDim, roofDimIndex) => {
      const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
      const dimension = sectionRafterDimensionLabel(model, roofDimIndex, roofDim.lengthM);
      return [
        boundsFromLine(roofDim.topStart.x, roofDim.topStart.y, roofDim.dimStart.x, roofDim.dimStart.y, 0.2),
        boundsFromLine(roofDim.topEnd.x, roofDim.topEnd.y, roofDim.dimEnd.x, roofDim.dimEnd.y, 0.2),
        estimateTickDimensionBounds({
          x1: roofDim.dimStart.x,
          y1: roofDim.dimStart.y,
          x2: roofDim.dimEnd.x,
          y2: roofDim.dimEnd.y,
          label: dimension.label,
          textX: (roofDim.dimStart.x + roofDim.dimEnd.x) / 2 - roofNormal.nx * (1.4 + roofLengthLabelGap),
          textY: (roofDim.dimStart.y + roofDim.dimEnd.y) / 2 - roofNormal.ny * 1.4,
          presentation,
        }),
      ];
    }),
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(gableLeftRafterStartX + 1.6, yHouseRafterUnder + 1.4, ridgeX, yRidgeUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(ridgeX, yRidgeUnder + 1.4, gableRightRafterEndX - 1.6, yRightEaveRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind !== 'gable'
      ? boundsFromLine(monoRafterStartX + 1.6, yHouseRafterUnder + 1.4, monoRafterEndX - 1.6, yOuterRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled
      ? estimateTextBounds({
          text: `Internal roof angle ${model.pitchDeg.toFixed(1)} deg`,
          x: (xLeft + xRight) / 2,
          y: Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8),
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
    model.sectionKind === 'mono'
      ? estimateTickDimensionBounds({
          x1: depthDimTop.x,
          y1: depthDimTop.y,
          x2: depthDimBottom.x,
          y2: depthDimBottom.y,
          label: `${Math.round(model.rafterDepthM * 1000)}mm`,
          textX: depthDimTop.x - 1.3,
          textY: depthDimTop.y - 2.5,
          overrun: 1.1,
          presentation,
        })
      : null,
    boundsFromLine(leftDimX - 2.4, yHouseUnder, xLeft + 2.4, yHouseUnder, 0.2),
    boundsFromLine(xRight - 2.4, yOuterGutterUnder, rightDimX + 2.4, yOuterGutterUnder, 0.2),
    overhangM > 0 ? boundsFromLine(xSupport, spanAnchorSupportY, xSupport, overhangDimY, 0.2) : null,
    overhangM > 0 ? boundsFromLine(xRight, spanAnchorRightY, xRight, overhangDimY, 0.2) : null,
    overhangM > 0
      ? estimateTickDimensionBounds({ x1: xSupport, y1: overhangDimY, x2: xRight, y2: overhangDimY, label: `OH ${formatMetres(overhangM)}`, presentation })
      : null,
    boundsFromLine(xLeft, spanAnchorLeftY, xLeft, spanDimY, 0.2),
    boundsFromLine(xRight, spanAnchorRightY, xRight, spanDimY, 0.2),
    estimateTickDimensionBounds({
      x1: xLeft,
      y1: spanDimY,
      x2: xRight,
      y2: spanDimY,
      label: formatMetres(model.spanA),
      textY: spanDimY - 1.8,
      presentation,
    }),
    boundsFromLine(xLeft, yGround, leftDimX, yGround, 0.2),
    boundsFromLine(xLeft, yHouseUnder, leftDimX, yHouseUnder, 0.2),
    estimateTickDimensionBounds({ x1: leftDimX, y1: yGround, x2: leftDimX, y2: yHouseUnder, label: formatMetres(model.leftEdgeHeightM), presentation }),
    boundsFromLine(xRight, yGround, rightDimX, yGround, 0.2),
    boundsFromLine(xRight, yOuterGutterUnder, rightDimX, yOuterGutterUnder, 0.2),
    estimateTickDimensionBounds({ x1: rightDimX, y1: yGround, x2: rightDimX, y2: yOuterGutterUnder, label: formatMetres(outerGutterUndersideM), presentation }),
    estimateTextBounds({
      text: `Pitch ${model.pitchDeg.toFixed(1)} deg`,
      x: (xLeft + xRight) / 2,
      y: pitchLabelY,
      anchor: 'middle',
      fontHeight: 1.9,
      charWidth: 0.6,
      paddingX: 0.25,
      paddingY: 0.18,
    }),
    model.roofType === 'hip_corner'
      ? estimateTextBounds({
          text: 'Primary wing section (A)',
          x: (xLeft + xRight) / 2,
          y: metaLabelY,
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
  ]);
}


function resolveSectionSheetLayoutForScale(input: {
  model: ModuleSectionModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getSectionSheetFrame(input.model.sectionKind);
  const extents = getSectionRealExtents(input.model);
  let xLeft = frame.fitArea.x + (frame.fitArea.width - extents.widthM * input.scale) / 2;
  let yGround = frame.fitArea.y + extents.heightM * input.scale + Math.max(0, frame.fitArea.height - extents.heightM * input.scale) * frame.verticalBias;
  let bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    xLeft += offset.dx;
    yGround += offset.dy;
    bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x: xLeft,
    y: yGround,
    scale: input.scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
  };
}


export function resolveSectionSheetLayout(input: {
  model: ModuleSectionModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolveSectionSheetLayoutForScale({
      model: input.model,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const extents = getSectionRealExtents(input.model);
  const fitFrame = getSectionSheetFrame(input.model.sectionKind);
  return resolveMeasuredFitLayout({
    initialScale: Math.min(fitFrame.fitArea.width / Math.max(extents.widthM, 0.1), fitFrame.fitArea.height / Math.max(extents.heightM, 0.1)),
    resolveForScale: (scale) => resolveSectionSheetLayoutForScale({ model: input.model, scale }),
  });
}


export function resolveSectionModelSpaceLayout(model: ModuleSectionModel): ResolvedModelSpaceLayout {
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const extents = getSectionRealExtents(model);
  const x = 0;
  const y = extents.heightM * scale;
  const annotatedBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model' });
  const focusBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model', includeHouseContext: false });
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x,
    y,
    scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
    ...svgMetrics,
    ...focusMetrics,
    ...worldMetrics,
  };
}


