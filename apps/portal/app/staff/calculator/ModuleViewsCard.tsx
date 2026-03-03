import { useId, useState } from 'react';
import styles from './CalculatorGrid.module.css';
import type { ModulePlanModel, ModuleSectionModel } from './moduleViews';

export type ModuleViewsTab = 'plan' | 'section';
export type ModuleViewsStatus = 'loading' | 'ready' | 'error' | 'empty';
type ModuleDetailMode = 'technical' | 'clean';

type ModuleViewsCardProps = {
  moduleLabel: string;
  view: ModuleViewsTab;
  onViewChange: (next: ModuleViewsTab) => void;
  status: ModuleViewsStatus;
  statusDetail?: string;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
};

const TAB_ITEMS: Array<{ id: ModuleViewsTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'section', label: 'Section' },
];

const DETAIL_ITEMS: Array<{ id: ModuleDetailMode; label: string }> = [
  { id: 'technical', label: 'Technical' },
  { id: 'clean', label: 'Clean' },
];

const STATUS_TEXT: Record<ModuleViewsStatus, string> = {
  loading: 'Updating module geometry...',
  ready: 'Plan schematic ready.',
  error: 'Live geometry is unavailable. Resolve calculation errors to restore derived data.',
  empty: 'Waiting for valid inputs before geometry is available.',
};

export default function ModuleViewsCard({
  moduleLabel,
  view,
  onViewChange,
  status,
  statusDetail,
  planModel,
  sectionModel,
}: ModuleViewsCardProps) {
  const [detailMode, setDetailMode] = useState<ModuleDetailMode>('technical');
  const showPlan = view === 'plan' && Boolean(planModel);
  const showSection = view === 'section' && Boolean(sectionModel);
  const stateText = view === 'section' && status === 'ready' ? 'Section schematic ready.' : STATUS_TEXT[status];
  const svgId = useId().replace(/:/g, '_');

  return (
    <section className={`${styles.previewCard} ${styles.moduleViewsCard}`} aria-label="Module views">
      <div className={styles.moduleViewsHeader}>
        <div className={styles.moduleViewsTitleWrap}>
          <h2 className={styles.previewCardTitle}>Module views</h2>
          <div className={styles.moduleViewsSubtitle}>{moduleLabel}</div>
        </div>

        <div className={styles.moduleViewsControls}>
          <div className={styles.moduleViewsTabs} role="tablist" aria-label="View type">
            {TAB_ITEMS.map((item) => {
              const active = item.id === view;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? `${styles.moduleViewsTabButton} ${styles.moduleViewsTabButtonActive}` : styles.moduleViewsTabButton}
                  onClick={() => onViewChange(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className={styles.moduleViewsDetailToggle} role="tablist" aria-label="Drawing detail">
            {DETAIL_ITEMS.map((item) => {
              const active = item.id === detailMode;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? `${styles.moduleViewsDetailButton} ${styles.moduleViewsDetailButtonActive}` : styles.moduleViewsDetailButton}
                  onClick={() => setDetailMode(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.moduleViewsStage} aria-live="polite">
        {showPlan && planModel ? (
          <div className={styles.modulePlanFrame}>
            <div className={planModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
              {planModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
            </div>
            <PlanSvg model={planModel} detailMode={detailMode} idBase={`${svgId}_plan`} />
            <LegendRow
              detailMode={detailMode}
              items={
                planModel.houseConnectionType === 'soffit'
                  ? ['Frame member', 'Rafters', 'Soffit brackets', 'House side']
                  : ['Frame member', 'Rafters', 'House side']
              }
            />
            <div className={styles.modulePlanStats}>
              <span className={styles.modulePlanStat}>{`A: ${formatMetres(planModel.lengthA)} x ${formatMetres(planModel.spanA)}`}</span>
              {planModel.roofType === 'hip_corner' && planModel.lengthB && planModel.spanB ? (
                <span className={styles.modulePlanStat}>{`B: ${formatMetres(planModel.lengthB)} x ${formatMetres(planModel.spanB)}`}</span>
              ) : null}
              <span className={styles.modulePlanStat}>{`Roof: ${roofTypeLabel(planModel.roofType)}`}</span>
              <span className={styles.modulePlanStat}>{`Rafters: ${planModel.rafterCountA} @ ${formatMetres(planModel.rafterSpacingA)} c/c`}</span>
              {planModel.houseConnectionType === 'soffit' ? (
                <span className={styles.modulePlanStat}>{`Soffit brackets: ${planModel.soffitBracketPositionsA.length}`}</span>
              ) : null}
              {planModel.boxPerimeterEnabled ? <span className={styles.modulePlanStat}>Box perimeter enabled</span> : null}
            </div>
          </div>
        ) : showSection && sectionModel ? (
          <div className={styles.modulePlanFrame}>
            <div className={sectionModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
              {sectionModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
            </div>
            <SectionSvg model={sectionModel} detailMode={detailMode} />
            <LegendRow
              detailMode={detailMode}
              items={
                sectionModel.overhangEnabled && sectionModel.overhangAmountM > 0
                  ? ['Primary frame', 'Internal roof line', 'Overhang support']
                  : ['Primary frame', 'Internal roof line']
              }
            />
            <div className={styles.modulePlanStats}>
              <span className={styles.modulePlanStat}>{`Span: ${formatMetres(sectionModel.spanA)}`}</span>
              <span className={styles.modulePlanStat}>{`Pitch: ${sectionModel.pitchDeg.toFixed(1)} deg`}</span>
              <span className={styles.modulePlanStat}>{`House: ${formatMetres(sectionModel.leftEdgeHeightM)}`}</span>
              <span className={styles.modulePlanStat}>{`Outer: ${formatMetres(sectionModel.rightEdgeHeightM)}`}</span>
              {typeof sectionModel.ridgeHeightM === 'number' ? (
                <span className={styles.modulePlanStat}>{`Ridge: ${formatMetres(sectionModel.ridgeHeightM)}`}</span>
              ) : null}
              {sectionModel.overhangEnabled && sectionModel.overhangAmountM > 0 ? (
                <span className={styles.modulePlanStat}>{`Overhang: ${formatMetres(sectionModel.overhangAmountM)}`}</span>
              ) : null}
              {sectionModel.boxPerimeterEnabled && sectionModel.boxRiseM ? (
                <span className={styles.modulePlanStat}>{`Box fall: ${formatMetres(sectionModel.boxRiseM)}`}</span>
              ) : null}
              {sectionModel.roofType === 'hip_corner' ? <span className={styles.modulePlanStat}>Primary wing section (A)</span> : null}
            </div>
          </div>
        ) : (
          <p className={styles.moduleViewsStateText}>{stateText}</p>
        )}
        {statusDetail ? <p className={styles.moduleViewsStateDetail}>{statusDetail}</p> : null}
      </div>

      <div className={styles.moduleViewsMeta}>
        <span>Not to scale</span>
        <span>{view === 'plan' ? 'Plan schematic' : 'Section schematic'}</span>
      </div>
    </section>
  );
}

type Point = { x: number; y: number };

type TickDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  textX?: number;
  textY?: number;
  rotateDeg?: number;
};

function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roofTypeLabel(roofType: ModulePlanModel['roofType']): string {
  if (roofType === 'hip_corner') return 'Hip corner';
  if (roofType === 'low_gable') return 'Low gable';
  if (roofType === 'gable') return 'Gable';
  if (roofType === 'hip') return 'Hip';
  return 'Pitched';
}

function toPointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function projectLinearPositions(positionsM: number[] | null, lengthM: number | null, startX: number, drawWidth: number): number[] {
  if (!positionsM || !positionsM.length || !lengthM || lengthM <= 0) return [];
  return positionsM.map((posM) => startX + (Math.max(0, posM) / lengthM) * drawWidth);
}

function LegendRow({ detailMode, items }: { detailMode: ModuleDetailMode; items: string[] }) {
  if (detailMode !== 'technical') return null;
  return (
    <div className={styles.moduleViewsLegend} aria-label="Drawing legend">
      {items.map((item) => (
        <span key={item} className={styles.moduleViewsLegendChip}>
          <span className={styles.moduleViewsLegendSwatch} aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

function TickDimension({ x1, y1, x2, y2, label, textX, textY, rotateDeg }: TickDimensionProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = 1.15;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const labelX = textX ?? (isHorizontal ? cx : cx - 2.8);
  const labelY = textY ?? (isHorizontal ? cy - 1.8 : cy);
  const labelRotate = rotateDeg ?? (isHorizontal ? undefined : -90);

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.moduleDimLine} />
      <line x1={x1 - tx} y1={y1 - ty} x2={x1 + tx} y2={y1 + ty} className={styles.moduleDimTick} />
      <line x1={x2 - tx} y1={y2 - ty} x2={x2 + tx} y2={y2 + ty} className={styles.moduleDimTick} />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        className={styles.moduleDimText}
        transform={typeof labelRotate === 'number' ? `rotate(${labelRotate} ${labelX} ${labelY})` : undefined}
      >
        {label}
      </text>
    </g>
  );
}

function ArrowHead({ x, y, direction }: { x: number; y: number; direction: 'up' | 'down' }) {
  if (direction === 'up') {
    return <polygon points={`${x.toFixed(2)},${(y - 1.5).toFixed(2)} ${(x - 1.3).toFixed(2)},${(y + 1.1).toFixed(2)} ${(x + 1.3).toFixed(2)},${(y + 1.1).toFixed(2)}`} className={styles.moduleFallHead} />;
  }
  return <polygon points={`${x.toFixed(2)},${(y + 1.5).toFixed(2)} ${(x - 1.3).toFixed(2)},${(y - 1.1).toFixed(2)} ${(x + 1.3).toFixed(2)},${(y - 1.1).toFixed(2)}`} className={styles.moduleFallHead} />;
}

function PlanSvg({ model, detailMode, idBase }: { model: ModulePlanModel; detailMode: ModuleDetailMode; idBase: string }) {
  const technical = detailMode === 'technical';
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const totalW = isHipCorner ? Math.max(model.lengthA, model.lengthB ?? 0) : model.lengthA;
  const totalH = isHipCorner ? model.spanA + (model.spanB ?? 0) : model.spanA;

  const maxW = 74;
  const maxH = 42;
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  const scale = Math.min(maxW / safeW, maxH / safeH);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  const x = 23 + (maxW - widthPx) / 2;
  const y = 20 + (maxH - heightPx) / 2;

  const aW = model.lengthA * scale;
  const aH = model.spanA * scale;
  const bW = (model.lengthB ?? 0) * scale;
  const bH = (model.spanB ?? 0) * scale;
  const splitY = y + aH;
  const bottomY = splitY + bH;
  const beamW = clamp(0.05 * scale, 1.2, 2.8);

  const primaryPoints: Point[] = isHipCorner
    ? [
        { x, y },
        { x: x + aW, y },
        { x: x + aW, y: splitY },
        { x: x + bW, y: splitY },
        { x: x + bW, y: bottomY },
        { x, y: bottomY },
      ]
    : [
        { x, y },
        { x: x + aW, y },
        { x: x + aW, y: y + aH },
        { x, y: y + aH },
      ];

  const centerX = x + (isHipCorner ? Math.max(aW, bW) : aW) / 2;
  const centerY = y + (isHipCorner ? aH + bH : aH) / 2;
  const insetScale = 0.92;
  const insetPoints = primaryPoints.map((point) => ({
    x: centerX + (point.x - centerX) * insetScale,
    y: centerY + (point.y - centerY) * insetScale,
  }));

  const gableMidY = y + aH / 2;
  const hipRidgeStartX = x + aW * 0.32;
  const hipRidgeEndX = x + aW * 0.68;
  const houseBottomY = y - 2;
  const houseTopY = Math.max(4, houseBottomY - 8);
  const houseLeftX = Math.max(6, x - 2);
  const houseRightX = Math.min(114, x + Math.max(aW, bW) + 2);
  const hatchId = `${idBase}_house_hatch`;

  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.lengthA, x, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, x, bW);
  const soffitXs = projectLinearPositions(model.soffitBracketPositionsA, model.lengthA, x, aW);

  const fallX = Math.min(112, x + Math.max(aW, bW) + 8);
  const fallTop = y + 1;
  const fallBottom = (isHipCorner ? bottomY : y + aH) - 1;

  const dimBaseY = Math.min(86, bottomY + 6.5);
  const rafterDimY = Math.min(88, dimBaseY + 5.2);

  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Module plan view" className={styles.modulePlanSvg}>
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" className={styles.moduleHouseHatchLine} />
        </pattern>
      </defs>

      <rect x={houseLeftX} y={houseTopY} width={houseRightX - houseLeftX} height={houseBottomY - houseTopY} fill={`url(#${hatchId})`} className={styles.moduleHouseHatch} />
      <text x={houseLeftX + 1.5} y={houseTopY + 3.1} className={styles.moduleHouseLabel}>
        House side
      </text>

      <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanFill} />
      <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanPerimeter} style={{ strokeWidth: beamW }} />

      {model.boxPerimeterEnabled ? <polygon points={toPointsAttr(insetPoints)} className={styles.modulePlanBoxInset} /> : null}

      {isGableLike ? <line x1={x + 7} y1={gableMidY} x2={x + aW - 7} y2={gableMidY} className={styles.modulePlanRidge} /> : null}

      {model.roofType === 'hip' ? (
        <>
          <line x1={hipRidgeStartX} y1={gableMidY} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanRidge} />
          <line x1={x} y1={y} x2={hipRidgeStartX} y2={gableMidY} className={styles.modulePlanHipLine} />
          <line x1={x + aW} y1={y} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanHipLine} />
          <line x1={x} y1={y + aH} x2={hipRidgeStartX} y2={gableMidY} className={styles.modulePlanHipLine} />
          <line x1={x + aW} y1={y + aH} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanHipLine} />
        </>
      ) : null}

      {isHipCorner ? <line x1={x} y1={splitY} x2={x + bW} y2={splitY} className={styles.modulePlanJointLine} /> : null}

      {technical
        ? rafterXsA.map((rx) => <line key={`rafter_a_${rx.toFixed(3)}`} x1={rx} y1={y + beamW * 0.6} x2={rx} y2={splitY - beamW * 0.6} className={styles.modulePlanRafter} />)
        : null}

      {technical && isHipCorner
        ? rafterXsB.map((rx) => <line key={`rafter_b_${rx.toFixed(3)}`} x1={rx} y1={splitY + beamW * 0.6} x2={rx} y2={bottomY - beamW * 0.6} className={styles.modulePlanRafter} />)
        : null}

      {technical && model.houseConnectionType === 'soffit' && soffitXs.length > 0 ? (
        <>
          <line x1={soffitXs[0]} y1={y - 1.2} x2={soffitXs[soffitXs.length - 1]} y2={y - 1.2} className={styles.modulePlanSoffitGuide} />
          {soffitXs.map((sx) => (
            <line key={`bracket_${sx.toFixed(3)}`} x1={sx} y1={y - 2.3} x2={sx} y2={y + 0.1} className={styles.modulePlanSoffitBracket} />
          ))}
        </>
      ) : null}

      {model.overhangEnabled && model.overhangAmountM > 0 ? (
        <rect x={x + beamW * 0.4} y={splitY - beamW * 0.3} width={(isHipCorner ? bW : aW) - beamW * 0.8} height={Math.max(1, model.overhangAmountM * scale)} className={styles.modulePlanOverhangZone} />
      ) : null}

      {model.boxPerimeterEnabled && technical ? (
        <>
          <line x1={centerX} y1={y + 2.8} x2={centerX} y2={(isHipCorner ? bottomY : y + aH) - 2.8} className={styles.modulePlanInternalAngle} />
          <text x={centerX + 2.5} y={centerY + 0.5} className={styles.modulePlanAngleText}>
            internal roof angle
          </text>
        </>
      ) : null}

      <line x1={fallX} y1={fallTop} x2={fallX} y2={fallBottom} className={styles.moduleFallLine} />
      {isGableLike ? (
        <>
          <ArrowHead x={fallX} y={fallTop} direction="up" />
          <ArrowHead x={fallX} y={fallBottom} direction="down" />
          <text x={fallX + 2.3} y={(fallTop + fallBottom) / 2} className={styles.moduleFallLabel}>
            fall both sides
          </text>
        </>
      ) : (
        <>
          <ArrowHead x={fallX} y={model.slopeDirection === 'toward_house' ? fallTop : fallBottom} direction={model.slopeDirection === 'toward_house' ? 'up' : 'down'} />
          <text x={fallX + 2.3} y={(fallTop + fallBottom) / 2} className={styles.moduleFallLabel}>
            fall
          </text>
        </>
      )}

      <TickDimension x1={x} y1={dimBaseY} x2={x + aW} y2={dimBaseY} label={formatMetres(model.lengthA)} />
      <TickDimension x1={x - 6.2} y1={y} x2={x - 6.2} y2={y + aH} label={formatMetres(model.spanA)} />

      {isHipCorner && model.lengthB && model.spanB ? (
        <>
          <TickDimension x1={x} y1={Math.min(88, dimBaseY + 4.8)} x2={x + bW} y2={Math.min(88, dimBaseY + 4.8)} label={formatMetres(model.lengthB)} />
          <TickDimension x1={x + bW + 6.2} y1={splitY} x2={x + bW + 6.2} y2={bottomY} label={formatMetres(model.spanB)} />
        </>
      ) : null}

      {technical && rafterXsA.length >= 2 ? (
        <TickDimension
          x1={rafterXsA[0]}
          y1={rafterDimY}
          x2={rafterXsA[1]}
          y2={rafterDimY}
          label={`${formatMetres(model.rafterSpacingA)} c/c`}
          textY={rafterDimY - 1.3}
        />
      ) : null}
    </svg>
  );
}

function SectionSvg({ model, detailMode }: { model: ModuleSectionModel; detailMode: ModuleDetailMode }) {
  const technical = detailMode === 'technical';
  const overhangM = model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, model.overhangAmountM) : 0;
  const totalSpanM = model.spanA + overhangM;

  const chartWidth = 84;
  const topMargin = 16;
  const yGround = 72;
  const safeSpanM = Math.max(totalSpanM, 0.1);

  const slopeHeightPerM = model.spanA > 0 ? (model.rightEdgeHeightM - model.leftEdgeHeightM) / model.spanA : 0;
  const overhangHeightM = model.rightEdgeHeightM + slopeHeightPerM * overhangM;

  const heights = [
    model.leftEdgeHeightM,
    model.rightEdgeHeightM,
    overhangM > 0 ? overhangHeightM : null,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : null,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const maxHeightM = Math.max(0.1, ...(heights.length ? heights : [0.1]));

  const availableHeight = Math.max(10, yGround - topMargin);
  const scaleX = chartWidth / safeSpanM;
  const scaleY = availableHeight / maxHeightM;
  const scale = Math.min(scaleX, scaleY);
  const beamW = clamp(0.05 * scale, 1.2, 2.8);

  const drawWidth = safeSpanM * scale;
  const xLeft = (120 - drawWidth) / 2;
  const xMainRight = xLeft + model.spanA * scale;
  const xRight = xLeft + safeSpanM * scale;
  const ridgeX = (xLeft + xMainRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;

  const yLeft = yForHeight(model.leftEdgeHeightM);
  const yMainRight = yForHeight(model.rightEdgeHeightM);
  const yRight = yForHeight(overhangM > 0 ? overhangHeightM : model.rightEdgeHeightM);
  const yRidge = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;

  const leftDimX = Math.max(6, xLeft - 7.4);
  const rightDimX = Math.min(114, xMainRight + 7.4);
  const spanDimY = Math.min(87, yGround + 6.3);

  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Module section view" className={styles.modulePlanSvg}>
      <rect x={Math.max(8, xLeft - 8)} y={yGround + 1.3} width={Math.min(104, xRight + 8) - Math.max(8, xLeft - 8)} height={8} className={styles.moduleSectionGroundFill} />
      <line x1={Math.max(8, xLeft - 8)} y1={yGround} x2={Math.min(112, xRight + 8)} y2={yGround} className={styles.moduleSectionGround} />

      <line x1={xLeft} y1={yGround} x2={xLeft} y2={yLeft} className={styles.moduleSectionPost} style={{ strokeWidth: beamW }} />
      <line x1={xMainRight} y1={yGround} x2={xMainRight} y2={yMainRight} className={styles.moduleSectionPost} style={{ strokeWidth: beamW }} />

      {model.sectionKind === 'gable' && yRidge !== null ? <line x1={ridgeX} y1={yGround} x2={ridgeX} y2={yRidge} className={styles.moduleSectionPostGhost} /> : null}

      {model.sectionKind === 'gable' && yRidge !== null ? (
        <>
          <line x1={xLeft} y1={yLeft} x2={ridgeX} y2={yRidge} className={styles.moduleSectionRoof} style={{ strokeWidth: beamW }} />
          <line x1={ridgeX} y1={yRidge} x2={xMainRight} y2={yMainRight} className={styles.moduleSectionRoof} style={{ strokeWidth: beamW }} />
        </>
      ) : (
        <>
          <line x1={xLeft} y1={yLeft} x2={xMainRight} y2={yMainRight} className={styles.moduleSectionRoof} style={{ strokeWidth: beamW }} />
          {overhangM > 0 ? <line x1={xMainRight} y1={yMainRight} x2={xRight} y2={yRight} className={styles.moduleSectionRoof} style={{ strokeWidth: beamW }} /> : null}
        </>
      )}

      {overhangM > 0 ? (
        <>
          <line x1={xMainRight} y1={yMainRight + beamW * 0.9} x2={xRight} y2={yRight + beamW * 0.9} className={styles.moduleSectionOverhangBeam} />
          <line x1={xRight} y1={yGround} x2={xRight} y2={yRight} className={styles.moduleSectionOverhangPost} />
        </>
      ) : null}

      {model.boxPerimeterEnabled ? (
        <>
          {model.sectionKind === 'gable' && yRidge !== null ? (
            <>
              <line x1={xLeft + 2.4} y1={yLeft + 2.2} x2={ridgeX} y2={yRidge + 2.2} className={styles.moduleSectionBoxRoof} />
              <line x1={ridgeX} y1={yRidge + 2.2} x2={xMainRight - 2.4} y2={yMainRight + 2.2} className={styles.moduleSectionBoxRoof} />
            </>
          ) : (
            <line x1={xLeft + 2.4} y1={yLeft + 2.2} x2={xRight - 2.4} y2={yRight + 2.2} className={styles.moduleSectionBoxRoof} />
          )}
          {technical ? (
            <text x={(xLeft + xMainRight) / 2} y={Math.min(yGround - 2.5, Math.max(yLeft, yMainRight) + 8)} textAnchor="middle" className={styles.moduleSectionAngleLabel}>
              {`Internal roof angle ${model.pitchDeg.toFixed(1)} deg`}
            </text>
          ) : null}
        </>
      ) : null}

      <TickDimension x1={xLeft} y1={spanDimY} x2={xMainRight} y2={spanDimY} label={formatMetres(model.spanA)} textY={spanDimY - 1.4} />
      {overhangM > 0 ? (
        <TickDimension x1={xMainRight} y1={Math.min(88.5, spanDimY + 4.9)} x2={xRight} y2={Math.min(88.5, spanDimY + 4.9)} label={`OH ${formatMetres(overhangM)}`} />
      ) : null}
      <TickDimension x1={leftDimX} y1={yGround} x2={leftDimX} y2={yLeft} label={formatMetres(model.leftEdgeHeightM)} />
      <TickDimension x1={rightDimX} y1={yGround} x2={rightDimX} y2={yMainRight} label={formatMetres(model.rightEdgeHeightM)} />

      <text x={(xLeft + xMainRight) / 2} y={88} textAnchor="middle" className={styles.moduleSectionPitchLabel}>
        {`Pitch ${model.pitchDeg.toFixed(1)} deg`}
      </text>

      {model.roofType === 'hip_corner' ? (
        <text x={(xLeft + xMainRight) / 2} y={84.8} textAnchor="middle" className={styles.moduleSectionMetaLabel}>
          Primary wing section (A)
        </text>
      ) : null}

    </svg>
  );
}
