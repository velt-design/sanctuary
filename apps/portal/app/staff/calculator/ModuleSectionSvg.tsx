import styles from './CalculatorGrid.module.css';
import { DEFAULT_ESTIMATE_DRAWING_SCALE, type EstimateDrawingScale } from '@/lib/estimates/drawingSheet';
import { getViewBoxUnitsPerMetreAtScale } from '@/lib/estimates/drawingSheetLayout';
import type { ModuleSectionModel } from './moduleViews';
import {
  DebugOutline,
  FocusTarget,
  TickDimension,
  buildSheetDebugMetrics,
  clamp,
  formatMetres,
  memberSizeM,
  resolveSectionFitFrame,
  resolveSectionModelSpaceLayout,
  resolveSectionSheetLayout,
  sectionHouseLineClass,
  sectionHousePointToSvg,
  sectionHouseSurfaceClass,
  sectionLedgerBeamDepthM,
  sectionLedgerBeamWidthM,
  sectionMemberPolygonPlumbCuts,
  sectionMonoRafterUndersideAtM,
  sectionOuterGutterUndersideM,
  sectionOverhangM,
  sectionRafterPlumbCutDropM,
  sectionRidgeBeamDepthM,
  sectionRidgeBeamWidthM,
  sectionSupportBeamDepthM,
  sectionSupportBeamWidthM,
  sectionSupportUndersideM,
  sectionSupportXFromHouseM,
  segmentDownNormal,
  toPointsAttr,
  type ModuleDrawingInteractiveFieldMap,
  type ModuleDrawingPresentation,
  type ModuleDrawingScaleDiagnostic,
  type ModuleDrawingScaleState,
  type Point,
} from './ModuleDrawingRenderer';

export function SectionSvg({
  model,
  presentation = 'card',
  drawingScale = DEFAULT_ESTIMATE_DRAWING_SCALE,
  sheetViewportMm,
  debugScaleState,
  scaleDiagnostics,
  interactiveFields,
  showDebugOverlays = false,
}: {
  model: ModuleSectionModel;
  presentation?: ModuleDrawingPresentation;
  drawingScale?: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  debugScaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  showDebugOverlays?: boolean;
}) {
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const sectionSheetLayout = isSheet ? resolveSectionSheetLayout({ model, drawingScale, viewportMm: sheetViewportMm }) : null;
  const modelSpaceLayout = isModel ? resolveSectionModelSpaceLayout(model) : null;
  const modelSvgStyle = modelSpaceLayout
    ? {
        width: `${modelSpaceLayout.svgWidthPx}px`,
        height: `${modelSpaceLayout.svgHeightPx}px`,
      }
    : undefined;
  const overhangM = sectionOverhangM(model);
  const totalSpanM = Math.max(model.spanA, 0.001);
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

  const fitFrame = resolveSectionFitFrame(presentation, model.sectionKind);
  const outerFieldOutline = sectionSheetLayout?.outerField ?? null;
  const fitAreaOutline = sectionSheetLayout?.fitArea ?? null;
  const annotatedBoundsOutline = sectionSheetLayout?.annotatedBounds ?? null;
  const debugMetrics = sectionSheetLayout ? buildSheetDebugMetrics(sectionSheetLayout, debugScaleState, scaleDiagnostics) : null;
  const chartWidth = Math.max(12, fitFrame.fitArea.width);
  const topMargin = fitFrame.fitArea.y;
  const safeSpanM = Math.max(totalSpanM, 0.1);

  const heights = [
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
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : null,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM + ridgeBeamDepthM + model.rafterDepthM : null,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const maxHeightM = Math.max(0.1, ...(heights.length ? heights : [0.1]));

  const availableHeight = Math.max(10, fitFrame.fitArea.height);
  const fixedScale = isSheet && drawingScale.mode === 'fixed' ? getViewBoxUnitsPerMetreAtScale(drawingScale.ratio, sheetViewportMm) : null;
  const scale =
    sectionSheetLayout?.scale ??
    modelSpaceLayout?.scale ??
    fixedScale ??
    (() => {
      const scaleX = chartWidth / safeSpanM;
      const scaleY = availableHeight / maxHeightM;
      return Math.min(scaleX, scaleY);
    })();
  const drawHeight = maxHeightM * scale;
  const topOffset =
    sectionSheetLayout || modelSpaceLayout
      ? (sectionSheetLayout?.y ?? modelSpaceLayout?.y ?? 0) - drawHeight
      : topMargin + Math.max(0, availableHeight - drawHeight) * fitFrame.verticalBias;
  const yGround = sectionSheetLayout?.y ?? modelSpaceLayout?.y ?? topOffset + drawHeight;

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

  const drawWidth = safeSpanM * scale;
  const xLeft = sectionSheetLayout?.x ?? modelSpaceLayout?.x ?? (fitFrame.fitArea.x + (chartWidth - drawWidth) / 2);
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
  const tieBeamLeftX = xLeft;
  const tieBeamRightX = xRight;
  const kingStrutBottomY = tieBeamTopY;
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

  const leftDimX = isModel ? xLeft - 8.6 : Math.max(6, xLeft - (isSheet ? 9.8 : 8.6));
  const rightDimX = isModel ? xRight + 9.4 : Math.min(114, xRight + (isSheet ? 10.6 : 9.4));
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = isModel
    ? Math.max(yGround + 10.2, spanDatumY + 8.4)
    : Math.min(89.2, Math.max(yGround + (isSheet ? 10.9 : 10.2), spanDatumY + (isSheet ? 9.4 : 8.4)));
  const overhangDimY = Math.max(spanAnchorRightY + (isSheet ? 4.9 : 4.2), spanDimY - (isSheet ? 5.8 : 5.2));
  const pitchLabelY = isSheet || isModel ? spanDimY + 6.2 : 88;
  const metaLabelY = isSheet || isModel ? pitchLabelY - 3.2 : 84.8;
  const roofLengthLabelGap = isSheet ? 1.6 : 1.2;
  const pitchInteractiveField = interactiveFields?.['section:pitch'];

  const mainRoofNormal = segmentDownNormal(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;

  const monoRoofGeom = model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder, rafterDepth) : null;

  const gableLeftRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(gableLeftRafterStartX, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth);
  })();

  const gableRightRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, gableRightRafterEndX, yRightEaveRafterUnder, rafterDepth);
  })();

  const monoSupportSplice = (() => {
    if (model.sectionKind !== 'mono' || overhangM <= 0 || !monoRoofGeom || monoRafterEndX - monoRafterStartX <= 1e-6) return null;
    const t = clamp((xSupport - monoRafterStartX) / (monoRafterEndX - monoRafterStartX), 0, 1);
    const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
    const topStart = monoRoofGeom.points[3]!;
    const topEnd = monoRoofGeom.points[2]!;
    const yTop = topStart.y + (topEnd.y - topStart.y) * t;
    return { yTop, yUnder };
  })();

  const depthDimAlongRoof = isSheet ? 0.18 : 0.24;
  const depthDimUnderX = monoRafterStartX + (monoRafterEndX - monoRafterStartX) * depthDimAlongRoof;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * depthDimAlongRoof;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };
  const roofTopLengthDims = (() => {
    const offset = isSheet ? (model.sectionKind === 'gable' ? 4.8 : 4.2) : 2.7;
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
  const semanticSectionHouseSurfaces = (model.houseContext?.surfaces ?? []).map((surface) => ({
    ...surface,
    points: surface.boundary.map((point) => sectionHousePointToSvg(point, xLeft, yGround, scale)),
  }));
  const semanticSectionHouseLines = (model.houseContext?.lines ?? []).map((line) => ({
    ...line,
    start: sectionHousePointToSvg(line.line.start, xLeft, yGround, scale),
    end: sectionHousePointToSvg(line.line.end, xLeft, yGround, scale),
  }));
  const hasSemanticSectionHouseContext = semanticSectionHouseSurfaces.length > 0 || semanticSectionHouseLines.length > 0;
  const groundLeftX = isModel ? xLeft - 8 : Math.max(8, xLeft - 8);
  const groundRightX = isModel ? xRight + 8 : Math.min(104, xRight + 8);
  const groundLineRightX = isModel ? xRight + 8 : Math.min(112, xRight + 8);

  return (
    <svg
      viewBox={modelSpaceLayout?.viewBoxValue ?? '0 0 120 90'}
      width={modelSpaceLayout?.svgWidthPx}
      height={modelSpaceLayout?.svgHeightPx}
      overflow={isModel ? 'visible' : undefined}
      style={modelSvgStyle}
      data-model-space-svg={isModel ? 'section' : undefined}
      data-model-space-view-box={modelSpaceLayout?.viewBoxValue}
      data-model-space-world-box={modelSpaceLayout?.worldBoxValue}
      data-model-space-focus-box={modelSpaceLayout?.focusBoxValue}
      role="img"
      aria-label="Module section view"
      className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
        presentation === 'sheet' ? styles.modulePlanSvgSheet : ''
      } ${isModel ? styles.modulePlanSvgModel : ''}`}
    >
      {modelSpaceLayout ? <FocusTarget rect={modelSpaceLayout.focusBox} /> : null}
      {showDebugOverlays && outerFieldOutline ? <DebugOutline rect={outerFieldOutline} className={styles.moduleDebugCropOutline} marker="outer-section" /> : null}

      {showDebugOverlays && fitAreaOutline ? <DebugOutline rect={fitAreaOutline} className={styles.moduleDebugFitOutline} marker="fit-section" /> : null}

      {showDebugOverlays && annotatedBoundsOutline ? (
        <DebugOutline
          rect={{
            x: annotatedBoundsOutline.minX,
            y: annotatedBoundsOutline.minY,
            width: annotatedBoundsOutline.maxX - annotatedBoundsOutline.minX,
            height: annotatedBoundsOutline.maxY - annotatedBoundsOutline.minY,
          }}
          className={styles.moduleDebugBoundsOutline}
          marker="bounds-section"
        />
      ) : null}

      {showDebugOverlays && debugMetrics && outerFieldOutline ? (
        <g className={styles.moduleDebugStats} aria-hidden="true">
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 1.6} className={styles.moduleDebugStatsText}>
            {`req ${debugMetrics.requestedScaleLabel} -> ${debugMetrics.appliedScaleLabel}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 3.1} className={styles.moduleDebugStatsText}>
            {`bounds ${debugMetrics.boundsWidth.toFixed(1)} x ${debugMetrics.boundsHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 4.6} className={styles.moduleDebugStatsText}>
            {`fit ${debugMetrics.fitWidth.toFixed(1)} x ${debugMetrics.fitHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 6.1} className={styles.moduleDebugStatsText}>
            {`util ${Math.round(debugMetrics.utilizationX * 100)}% x  ${Math.round(debugMetrics.utilizationY * 100)}% y`}
          </text>
          {debugMetrics.candidateLines.map((line, idx) => (
            <text key={`section-debug-scale-${line}`} x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 7.6 + idx * 1.5} className={styles.moduleDebugStatsText}>
              {line}
            </text>
          ))}
        </g>
      ) : null}

      <rect x={groundLeftX} y={yGround + 1.3} width={groundRightX - groundLeftX} height={8} className={styles.moduleSectionGroundFill} />
      <line x1={groundLeftX} y1={yGround} x2={groundLineRightX} y2={yGround} className={styles.moduleSectionGround} />

      {hasSemanticSectionHouseContext
        ? semanticSectionHouseSurfaces.map((surface) => (
            <polygon
              key={surface.id}
              points={toPointsAttr(surface.points)}
              className={sectionHouseSurfaceClass(surface.kind)}
              data-house-section-surface={surface.kind}
            />
          ))
        : null}
      {hasSemanticSectionHouseContext
        ? semanticSectionHouseLines.map((line) => (
            <line
              key={line.id}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
              className={sectionHouseLineClass(line.kind)}
              data-house-section-line={line.kind}
            />
          ))
        : null}

      <rect x={leftPostX} y={yHouseUnder} width={postW} height={yGround - yHouseUnder} className={styles.moduleSectionPostPrimary} />
      <rect x={secondPostX} y={supportPostTopY} width={postW} height={yGround - supportPostTopY} className={styles.moduleSectionPostPrimary} />
      <rect
        x={ledgerX}
        y={ledgerY}
        width={leftEaveWidth}
        height={leftEaveDepth}
        className={styles.moduleSectionPrimaryBeam}
      />
      {model.houseConnectionType === 'facade' && !hasSemanticSectionHouseContext ? (
        <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
      ) : null}
      {model.houseConnectionType === 'fascia' && !hasSemanticSectionHouseContext ? (
        <>
          <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
          <line x1={ledgerX - 1.1} y1={ledgerY - 0.9} x2={ledgerX + leftEaveWidth} y2={ledgerY - 0.9} className={styles.moduleSectionFasciaBand} />
        </>
      ) : null}
      {model.houseConnectionType === 'soffit' && !hasSemanticSectionHouseContext ? (
        <>
          <line x1={ledgerX - 0.25} y1={ledgerY - 1.25} x2={ledgerX + leftEaveWidth} y2={ledgerY - 1.25} className={styles.moduleSectionConnection} />
          <line x1={ledgerX + leftEaveWidth * 0.25} y1={ledgerY - 1.95} x2={ledgerX + leftEaveWidth * 0.25} y2={ledgerY - 0.15} className={styles.moduleSectionSoffitBracket} />
          <line x1={ledgerX + leftEaveWidth * 0.75} y1={ledgerY - 1.95} x2={ledgerX + leftEaveWidth * 0.75} y2={ledgerY - 0.15} className={styles.moduleSectionSoffitBracket} />
        </>
      ) : null}
      {model.sectionKind === 'mono' && overhangM > 0 ? (
        <rect x={xSupport - supportCapWidth / 2} y={supportCapTopY} width={supportCapWidth} height={supportCapDepth} className={styles.moduleSectionPrimaryBeam} />
      ) : model.sectionKind === 'gable' ? (
        <rect x={rightEaveX} y={rightEaveY} width={rightEaveBeamWidth} height={rightEaveBeamDepth} className={styles.moduleSectionPrimaryBeam} />
      ) : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
        <>
          <rect
            x={tieBeamLeftX}
            y={tieBeamTopY}
            width={Math.max(0.4, tieBeamRightX - tieBeamLeftX)}
            height={Math.max(0.2, tieBeamBottomY - tieBeamTopY)}
            className={styles.moduleSectionTieBeamPrimary}
          />
          <rect
            x={ridgeX - kingStrutWidth / 2}
            y={yRidgeUnder}
            width={kingStrutWidth}
            height={Math.max(0.2, kingStrutBottomY - yRidgeUnder)}
            className={styles.moduleSectionKingStrut}
          />
        </>
      ) : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? <line x1={ridgeX} y1={yGround} x2={ridgeX} y2={yRidgeUnder} className={styles.moduleSectionPostGhost} /> : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
        <>
          {gableLeftRoofGeom ? <polygon points={toPointsAttr(gableLeftRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
          {gableRightRoofGeom ? <polygon points={toPointsAttr(gableRightRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
          {yRidgeBeamTop !== null ? (
            <rect
              x={ridgeX - ridgeBeamWidth / 2}
              y={yRidgeBeamTop ?? yRidgeUnder}
              width={ridgeBeamWidth}
              height={Math.max(0.2, yRidgeUnder - (yRidgeBeamTop ?? yRidgeUnder))}
              className={styles.moduleSectionRidgeBeam}
            />
          ) : null}
        </>
      ) : (
        <>
          {monoRoofGeom ? <polygon points={toPointsAttr(monoRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
        </>
      )}

      {monoSupportSplice ? (
        <line
          x1={xSupport}
          y1={monoSupportSplice.yTop}
          x2={xSupport}
          y2={monoSupportSplice.yUnder}
          className={styles.moduleSectionConnection}
        />
      ) : null}

      {model.sectionKind === 'mono' ? (
        <rect
          x={xRight - gutterWidth}
          y={gutterTopY}
          width={gutterWidth}
          height={Math.max(0.2, yOuterGutterUnder - gutterTopY)}
          className={styles.moduleSectionGutter}
        />
      ) : null}

      {roofTopLengthDims.map((roofDim, idx) => (
        <g key={`roof-top-len-${idx}`}>
          <line x1={roofDim.topStart.x} y1={roofDim.topStart.y} x2={roofDim.dimStart.x} y2={roofDim.dimStart.y} className={styles.moduleDimWitness} />
          <line x1={roofDim.topEnd.x} y1={roofDim.topEnd.y} x2={roofDim.dimEnd.x} y2={roofDim.dimEnd.y} className={styles.moduleDimWitness} />
          <TickDimension
            x1={roofDim.dimStart.x}
            y1={roofDim.dimStart.y}
            x2={roofDim.dimEnd.x}
            y2={roofDim.dimEnd.y}
            label={formatMetres(roofDim.lengthM)}
            textX={(() => {
              const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
              return (roofDim.dimStart.x + roofDim.dimEnd.x) / 2 - roofNormal.nx * (isSheet ? 1.4 : 1.1);
            })() - (segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y).nx * roofLengthLabelGap)}
            textY={(() => {
              const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
              return (roofDim.dimStart.y + roofDim.dimEnd.y) / 2 - roofNormal.ny * (isSheet ? 1.4 : 1.1);
            })()}
            presentation={presentation}
          />
        </g>
      ))}

      {model.boxPerimeterEnabled ? (
        <>
          {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
            <>
              <line x1={gableLeftRafterStartX + 1.6} y1={yHouseRafterUnder + 1.4} x2={ridgeX} y2={yRidgeUnder + 1.4} className={styles.moduleSectionBoxRoof} />
              <line
                x1={ridgeX}
                y1={yRidgeUnder + 1.4}
                x2={gableRightRafterEndX - 1.6}
                y2={yRightEaveRafterUnder + 1.4}
                className={styles.moduleSectionBoxRoof}
              />
            </>
          ) : (
            <line x1={monoRafterStartX + 1.6} y1={yHouseRafterUnder + 1.4} x2={monoRafterEndX - 1.6} y2={yOuterRafterUnder + 1.4} className={styles.moduleSectionBoxRoof} />
          )}
          <text x={(xLeft + xRight) / 2} y={Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8)} textAnchor="middle" className={styles.moduleSectionAngleLabel}>
            {`Internal roof angle ${model.pitchDeg.toFixed(1)} deg`}
          </text>
        </>
      ) : null}

      {model.sectionKind === 'mono' ? (
        <TickDimension
          x1={depthDimTop.x}
          y1={depthDimTop.y}
          x2={depthDimBottom.x}
          y2={depthDimBottom.y}
          label={`${Math.round(model.rafterDepthM * 1000)}mm`}
          textX={isSheet ? depthDimTop.x - 1.3 : undefined}
          textY={depthDimTop.y - (isSheet ? 2.5 : 1.6)}
          overrun={1.1}
          presentation={presentation}
        />
      ) : null}

      <line x1={leftDimX - 2.4} y1={yHouseUnder} x2={xLeft + 2.4} y2={yHouseUnder} className={styles.moduleDimGuide} />
      <line x1={xRight - 2.4} y1={yOuterGutterUnder} x2={rightDimX + 2.4} y2={yOuterGutterUnder} className={styles.moduleDimGuide} />

      {overhangM > 0 ? (
        <>
          <line x1={xSupport} y1={spanAnchorSupportY} x2={xSupport} y2={overhangDimY} className={styles.moduleDimWitness} />
          <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={overhangDimY} className={styles.moduleDimWitness} />
          <TickDimension x1={xSupport} y1={overhangDimY} x2={xRight} y2={overhangDimY} label={`OH ${formatMetres(overhangM)}`} presentation={presentation} />
        </>
      ) : null}

      <line x1={xLeft} y1={spanAnchorLeftY} x2={xLeft} y2={spanDimY} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={spanDimY} className={styles.moduleDimWitness} />
      <TickDimension
        x1={xLeft}
        y1={spanDimY}
        x2={xRight}
        y2={spanDimY}
        label={formatMetres(model.spanA)}
        textY={spanDimY - (isSheet ? 1.8 : 1.4)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:spanA']}
      />

      <line x1={xLeft} y1={yGround} x2={leftDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xLeft} y1={yHouseUnder} x2={leftDimX} y2={yHouseUnder} className={styles.moduleDimWitness} />
      <TickDimension
        x1={leftDimX}
        y1={yGround}
        x2={leftDimX}
        y2={yHouseUnder}
        label={formatMetres(model.leftEdgeHeightM)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:heightLeft']}
      />

      <line x1={xRight} y1={yGround} x2={rightDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={yOuterGutterUnder} x2={rightDimX} y2={yOuterGutterUnder} className={styles.moduleDimWitness} />
      <TickDimension
        x1={rightDimX}
        y1={yGround}
        x2={rightDimX}
        y2={yOuterGutterUnder}
        label={formatMetres(outerGutterUndersideM)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:heightRight']}
      />

      <text
        x={(xLeft + xRight) / 2}
        y={pitchLabelY}
        textAnchor="middle"
        className={pitchInteractiveField ? `${styles.moduleSectionPitchLabel} ${styles.moduleDimTextEditable}` : styles.moduleSectionPitchLabel}
        data-editable-field-id={pitchInteractiveField?.fieldId}
        tabIndex={pitchInteractiveField?.onActivate ? 0 : undefined}
        onClick={pitchInteractiveField?.onActivate ? (event) => pitchInteractiveField.onActivate?.(pitchInteractiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          pitchInteractiveField?.onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                pitchInteractiveField.onActivate?.(pitchInteractiveField.fieldId, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {`Pitch ${model.pitchDeg.toFixed(1)} deg`}
      </text>

      {model.roofType === 'hip_corner' ? (
        <text x={(xLeft + xRight) / 2} y={metaLabelY} textAnchor="middle" className={styles.moduleSectionMetaLabel}>
          Primary wing section (A)
        </text>
      ) : null}
    </svg>
  );
}
