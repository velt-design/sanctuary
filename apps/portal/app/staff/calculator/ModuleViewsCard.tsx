import { useId, useState } from 'react';
import styles from './CalculatorGrid.module.css';
import type { ModulePlanModel, ModuleSectionModel } from './moduleViews';

export type ModuleViewsTab = 'plan' | 'section';
export type ModuleViewsStatus = 'loading' | 'ready' | 'error' | 'empty';
type ModuleDetailMode = 'technical' | 'clean' | 'diagnostic';

type GeometryConsistency = {
  level: 'ok' | 'warn';
  summary: string;
  details: string[];
};

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
  { id: 'diagnostic', label: 'Diag' },
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
  const planConsistency = planModel ? checkPlanConsistency(planModel) : null;
  const sectionConsistency = sectionModel ? checkSectionConsistency(sectionModel) : null;
  const sectionOverhangDisplayM = sectionModel ? sectionOverhangM(sectionModel) : 0;
  const sectionOuterDisplayM = sectionModel ? sectionOuterGutterUndersideM(sectionModel) : null;
  const sectionSupportDisplayM = sectionModel ? sectionSupportUndersideM(sectionModel) : null;
  const activeConsistency = view === 'plan' ? planConsistency : sectionConsistency;
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
            <div className={styles.modulePlanSourceRow}>
              <div className={planModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {planModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
              </div>
              {planConsistency ? (
                <div className={planConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {planConsistency.level === 'ok' ? 'Geometry OK' : `Check ${planConsistency.details.length}`}
                </div>
              ) : null}
            </div>
            <PlanSvg model={planModel} detailMode={detailMode} idBase={`${svgId}_plan`} consistency={planConsistency} />
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
            <div className={styles.modulePlanSourceRow}>
              <div className={sectionModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {sectionModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
              </div>
              {sectionConsistency ? (
                <div className={sectionConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {sectionConsistency.level === 'ok' ? 'Geometry OK' : `Check ${sectionConsistency.details.length}`}
                </div>
              ) : null}
            </div>
            <SectionSvg model={sectionModel} detailMode={detailMode} consistency={sectionConsistency} />
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
              <span className={styles.modulePlanStat}>{`Outer: ${formatMetres(sectionOuterDisplayM ?? sectionModel.rightEdgeHeightM)}`}</span>
              {sectionOverhangDisplayM > 0 ? <span className={styles.modulePlanStat}>{`Support: ${formatMetres(sectionSupportDisplayM ?? sectionModel.rightEdgeHeightM)}`}</span> : null}
              <span className={styles.modulePlanStat}>{`Rafter: ${Math.round(sectionModel.rafterDepthM * 1000)}x${Math.round(sectionModel.rafterWidthM * 1000)}mm`}</span>
              <span className={styles.modulePlanStat}>{`Ledger: ${Math.round(sectionModel.ledgerBeamDepthM * 1000)}x${Math.round(sectionModel.ledgerBeamWidthM * 1000)}mm`}</span>
              <span className={styles.modulePlanStat}>{`Support beam: ${Math.round(sectionModel.supportBeamDepthM * 1000)}x${Math.round(sectionModel.supportBeamWidthM * 1000)}mm`}</span>
              <span className={styles.modulePlanStat}>{`Gutter: ${Math.round(sectionModel.gutterDepthM * 1000)}x${Math.round(sectionModel.gutterWidthM * 1000)}mm`}</span>
              {typeof sectionModel.ridgeHeightM === 'number' ? (
                <span className={styles.modulePlanStat}>{`Ridge beam: ${Math.round(sectionModel.ridgeBeamDepthM * 1000)}x${Math.round(sectionModel.ridgeBeamWidthM * 1000)}mm`}</span>
              ) : null}
              {typeof sectionModel.ridgeHeightM === 'number' ? (
                <span className={styles.modulePlanStat}>{`Ridge: ${formatMetres(sectionModel.ridgeHeightM)}`}</span>
              ) : null}
              {sectionOverhangDisplayM > 0 ? (
                <span className={styles.modulePlanStat}>{`Overhang: ${formatMetres(sectionOverhangDisplayM)}`}</span>
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
        {activeConsistency ? (
          <p className={activeConsistency.level === 'ok' ? styles.moduleViewsConsistencyOk : styles.moduleViewsConsistencyWarn}>
            {activeConsistency.summary}
          </p>
        ) : null}
        {activeConsistency && activeConsistency.level === 'warn' ? (
          <div className={styles.moduleViewsConsistencyList}>
            {activeConsistency.details.slice(0, 4).map((detail, idx) => (
              <p key={`${detail}-${idx}`} className={styles.moduleViewsConsistencyItem}>
                {detail}
              </p>
            ))}
            {activeConsistency.details.length > 4 ? (
              <p className={styles.moduleViewsConsistencyItem}>{`+${activeConsistency.details.length - 4} more`}</p>
            ) : null}
          </div>
        ) : null}
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
  overrun?: number;
  showTermBars?: boolean;
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

function summariseConsistency(issues: string[]): GeometryConsistency {
  if (issues.length === 0) {
    return {
      level: 'ok',
      summary: 'Geometry consistency checks passed.',
      details: [],
    };
  }
  return {
    level: 'warn',
    summary: `${issues.length} geometry consistency issue${issues.length === 1 ? '' : 's'} detected.`,
    details: issues,
  };
}

function checkPlanConsistency(model: ModulePlanModel): GeometryConsistency {
  const issues: string[] = [];
  const tolM = 0.02;
  const spacingTolM = 0.03;

  if (!(model.lengthA > 0)) issues.push('A length must be > 0.');
  if (!(model.spanA > 0)) issues.push('A span must be > 0.');
  if (model.overhangEnabled && model.overhangAmountM >= model.spanA - 1e-6) {
    issues.push(`Overhang ${formatMetres(model.overhangAmountM)} is not less than span ${formatMetres(model.spanA)}.`);
  }

  if (model.rafterPositionsA.length !== model.rafterCountA) {
    issues.push(`Rafter count mismatch: positions=${model.rafterPositionsA.length}, count=${model.rafterCountA}.`);
  }
  if (model.rafterPositionsA.length >= 2) {
    const start = model.rafterPositionsA[0] ?? 0;
    const end = model.rafterPositionsA[model.rafterPositionsA.length - 1] ?? 0;
    if (Math.abs(start) > tolM || Math.abs(end - model.lengthA) > tolM) {
      issues.push('Rafter extents do not align with A length bounds.');
    }

    const spacings = model.rafterPositionsA.slice(1).map((pos, idx) => pos - (model.rafterPositionsA[idx] ?? 0));
    const maxSpacing = Math.max(...spacings);
    if (maxSpacing > model.rafterMaxSpacingM + 1e-6) {
      issues.push(`Rafter spacing exceeds max (${formatMetres(maxSpacing)} > ${formatMetres(model.rafterMaxSpacingM)}).`);
    }
    const maxSpacingDelta = Math.max(...spacings.map((spacing) => Math.abs(spacing - model.rafterSpacingA)));
    if (maxSpacingDelta > spacingTolM) {
      issues.push(`Rafter spacing is non-uniform beyond tolerance (${formatMetres(maxSpacingDelta)}).`);
    }
  }

  if (model.houseConnectionType === 'soffit' && model.soffitBracketPositionsA.length >= 2) {
    const start = model.soffitBracketPositionsA[0] ?? 0;
    const end = model.soffitBracketPositionsA[model.soffitBracketPositionsA.length - 1] ?? 0;
    if (Math.abs(start - model.soffitBracketOffsetM) > tolM || Math.abs(end - (model.lengthA - model.soffitBracketOffsetM)) > tolM) {
      issues.push('Soffit bracket start/end offsets do not match configured offset.');
    }
    const bracketSpacings = model.soffitBracketPositionsA.slice(1).map((pos, idx) => pos - (model.soffitBracketPositionsA[idx] ?? 0));
    if (bracketSpacings.some((spacing) => spacing > model.soffitBracketMaxSpacingM + 1e-6)) {
      issues.push('Soffit bracket spacing exceeds configured maximum.');
    }
  }

  if (model.roofType === 'hip_corner' && model.lengthB && model.rafterPositionsB) {
    if (model.rafterPositionsB.length !== (model.rafterCountB ?? model.rafterPositionsB.length)) {
      issues.push('Hip corner B rafter count mismatch.');
    }
    if (model.rafterPositionsB.length >= 2) {
      const start = model.rafterPositionsB[0] ?? 0;
      const end = model.rafterPositionsB[model.rafterPositionsB.length - 1] ?? 0;
      if (Math.abs(start) > tolM || Math.abs(end - model.lengthB) > tolM) {
        issues.push('Hip corner B rafter extents do not align with B length.');
      }
    }
  }

  return summariseConsistency(issues);
}

function checkSectionConsistency(model: ModuleSectionModel): GeometryConsistency {
  const issues: string[] = [];
  const pitchTolDeg = 0.35;
  const heightTolM = 0.03;

  if (!(model.spanA > 0)) issues.push('Span must be > 0.');
  if (model.leftEdgeHeightM < 0 || model.rightEdgeHeightM < 0) issues.push('Post underside heights must be non-negative.');

  const overhangM = model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, model.overhangAmountM) : 0;
  if (overhangM > model.spanA + 1e-6) {
    issues.push(`Overhang ${formatMetres(overhangM)} exceeds span ${formatMetres(model.spanA)}.`);
  }

  const supportXFromHouseM = model.sectionKind === 'mono' ? model.spanA - overhangM : model.spanA;
  if (model.sectionKind === 'mono' && overhangM > 0 && supportXFromHouseM <= 0) {
    issues.push('Support position is non-positive after overhang.');
  }

  if (model.sectionKind === 'mono' && model.spanA > 0) {
    const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
    const fallM = outerGutterUndersideM - model.leftEdgeHeightM;
    const impliedPitchDeg = (Math.atan(Math.abs(fallM) / model.spanA) * 180) / Math.PI;
    if (Math.abs(impliedPitchDeg - model.pitchDeg) > pitchTolDeg) {
      issues.push(`Pitch mismatch: model ${model.pitchDeg.toFixed(2)} deg vs implied ${impliedPitchDeg.toFixed(2)} deg.`);
    }

    if (model.slopeDirection === 'away_from_house' && outerGutterUndersideM > model.leftEdgeHeightM + heightTolM) {
      issues.push('Slope direction says away from house, but outer underside is higher than house underside.');
    }
    if (model.slopeDirection === 'toward_house' && outerGutterUndersideM < model.leftEdgeHeightM - heightTolM) {
      issues.push('Slope direction says toward house, but outer underside is lower than house underside.');
    }
  }

  if (model.sectionKind === 'gable' && typeof model.ridgeHeightM === 'number' && Number.isFinite(model.ridgeHeightM)) {
    const eaveHeight = Math.max(model.leftEdgeHeightM, model.rightEdgeHeightM);
    const impliedRiseM = Math.tan((model.pitchDeg * Math.PI) / 180) * (model.spanA / 2);
    const expectedRidgeM = eaveHeight + impliedRiseM;
    if (Math.abs(expectedRidgeM - model.ridgeHeightM) > heightTolM) {
      issues.push(`Ridge height mismatch: model ${formatMetres(model.ridgeHeightM)} vs implied ${formatMetres(expectedRidgeM)}.`);
    }
  }

  return summariseConsistency(issues);
}

function sectionOverhangM(model: ModuleSectionModel): number {
  return model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, Math.min(model.overhangAmountM, Math.max(0, model.spanA - 0.01))) : 0;
}

function sectionSupportXFromHouseM(model: ModuleSectionModel): number {
  const overhangM = sectionOverhangM(model);
  return model.sectionKind === 'mono' ? Math.max(0.05, model.spanA - overhangM) : model.spanA;
}

function sectionLedgerBeamDepthM(model: ModuleSectionModel): number {
  return Math.max(0.03, Number.isFinite(model.ledgerBeamDepthM) ? model.ledgerBeamDepthM : 0.1);
}

function sectionLedgerBeamWidthM(model: ModuleSectionModel): number {
  return Math.max(0.02, Number.isFinite(model.ledgerBeamWidthM) ? model.ledgerBeamWidthM : 0.05);
}

function sectionSupportBeamDepthM(model: ModuleSectionModel): number {
  return Math.max(0.03, Number.isFinite(model.supportBeamDepthM) ? model.supportBeamDepthM : 0.15);
}

function sectionSupportBeamWidthM(model: ModuleSectionModel): number {
  return Math.max(0.02, Number.isFinite(model.supportBeamWidthM) ? model.supportBeamWidthM : 0.05);
}

function sectionRidgeBeamDepthM(model: ModuleSectionModel): number {
  return Math.max(0.03, Number.isFinite(model.ridgeBeamDepthM) ? model.ridgeBeamDepthM : 0.15);
}

function sectionRidgeBeamWidthM(model: ModuleSectionModel): number {
  return Math.max(0.02, Number.isFinite(model.ridgeBeamWidthM) ? model.ridgeBeamWidthM : 0.05);
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

function sectionMonoRightEdgeRole(model: ModuleSectionModel): 'gutter' | 'support' {
  return resolveMonoDatums(model).rightEdgeRole;
}

function sectionOuterGutterUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  return resolveMonoDatums(model).outerGutterUndersideM;
}

function sectionMonoRafterUndersideAtM(model: ModuleSectionModel, xFromHouseM: number): number {
  const spanM = Math.max(model.spanA, 0.001);
  const t = clamp(xFromHouseM / spanM, 0, 1);
  const houseRafterUndersideM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model);
  const outerRafterUndersideM = sectionOuterGutterUndersideM(model) + model.gutterDepthM;
  return houseRafterUndersideM + (outerRafterUndersideM - houseRafterUndersideM) * t;
}

function sectionSupportUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  const resolved = resolveMonoDatums(model);
  const overhangM = sectionOverhangM(model);
  if (overhangM <= 0) return resolved.supportUndersideM;

  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const supportTopM = sectionMonoRafterUndersideAtM(model, supportXFromHouseM);
  const supportFromStackM = Math.max(0, supportTopM - sectionSupportBeamDepthM(model));
  return supportFromStackM;
}

function toPointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function segmentDownNormal(x1: number, y1: number, x2: number, y2: number): { nx: number; ny: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx *= -1;
    ny *= -1;
  }
  return { nx, ny, len };
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

function sectionMemberPolygonPlumbCuts(
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

function hipCornerInnerPoints(x: number, y: number, aW: number, bW: number, splitY: number, bottomY: number, inset: number): Point[] {
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

function projectLinearPositions(positionsM: number[] | null, lengthM: number | null, startX: number, drawWidth: number): number[] {
  if (!positionsM || !positionsM.length || !lengthM || lengthM <= 0) return [];
  return positionsM.map((posM) => startX + (Math.max(0, posM) / lengthM) * drawWidth);
}

function LegendRow({ detailMode, items }: { detailMode: ModuleDetailMode; items: string[] }) {
  if (detailMode === 'clean') return null;
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

function DiagnosticsOverlay({
  title,
  lines,
  level,
  x = 8.5,
  y = 9.5,
}: {
  title: string;
  lines: string[];
  level: GeometryConsistency['level'];
  x?: number;
  y?: number;
}) {
  const pad = 1.4;
  const lineStep = 2.8;
  const width = 50;
  const lineCount = Math.max(1, lines.length);
  const height = pad * 2 + 2.6 + lineCount * lineStep;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={width} height={height} className={level === 'ok' ? styles.moduleDiagPanelOk : styles.moduleDiagPanelWarn} />
      <text x={pad} y={pad + 2.2} className={styles.moduleDiagTitle}>
        {title}
      </text>
      {lines.map((line, idx) => (
        <text key={`${line}-${idx}`} x={pad} y={pad + 4.8 + lineStep * idx} className={styles.moduleDiagText}>
          {line}
        </text>
      ))}
    </g>
  );
}

type DeltaRow = {
  metric: string;
  engine: number;
  view: number;
  tolerance: number;
  unit: 'm' | 'deg';
};

function formatDeltaCell(value: number, unit: DeltaRow['unit']): string {
  const digits = unit === 'deg' ? 2 : 3;
  return `${value.toFixed(digits)}${unit}`;
}

function DeltaTableOverlay({
  title,
  rows,
  x = 8.5,
  y = 33.0,
}: {
  title: string;
  rows: DeltaRow[];
  x?: number;
  y?: number;
}) {
  const pad = 1.2;
  const rowStep = 2.7;
  const width = 69;
  const height = pad * 2 + 3.2 + rows.length * rowStep;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={width} height={height} className={styles.moduleDeltaPanel} />
      <text x={pad} y={pad + 2.2} className={styles.moduleDeltaTitle}>
        {title}
      </text>
      {rows.map((row, idx) => {
        const delta = row.view - row.engine;
        const pass = Math.abs(delta) <= row.tolerance + 1e-9;
        const yRow = pad + 4.6 + rowStep * idx;
        return (
          <text key={`${row.metric}-${idx}`} x={pad} y={yRow} className={pass ? styles.moduleDeltaTextPass : styles.moduleDeltaTextFail}>
            {`${row.metric}: e=${formatDeltaCell(row.engine, row.unit)} v=${formatDeltaCell(row.view, row.unit)} d=${formatDeltaCell(delta, row.unit)} tol=${formatDeltaCell(row.tolerance, row.unit)} ${pass ? 'ok' : 'fail'}`}
          </text>
        );
      })}
    </g>
  );
}

function TickDimension({ x1, y1, x2, y2, label, textX, textY, rotateDeg, overrun = 2.7, showTermBars = true }: TickDimensionProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = 0.92;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const lineStartX = x1 - ux * overrun;
  const lineStartY = y1 - uy * overrun;
  const lineEndX = x2 + ux * overrun;
  const lineEndY = y2 + uy * overrun;
  const barHalf = 0.72;
  const barOffset = 0.55;

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const labelX = textX ?? (isHorizontal ? cx : cx - 2.8);
  const labelY = textY ?? (isHorizontal ? cy - 1.8 : cy);
  const labelRotate = rotateDeg ?? (isHorizontal ? undefined : -90);

  return (
    <g>
      <line x1={lineStartX} y1={lineStartY} x2={lineEndX} y2={lineEndY} className={styles.moduleDimLine} />
      {showTermBars ? (
        <>
          <line
            x1={x1 + ux * barOffset - nx * barHalf}
            y1={y1 + uy * barOffset - ny * barHalf}
            x2={x1 + ux * barOffset + nx * barHalf}
            y2={y1 + uy * barOffset + ny * barHalf}
            className={styles.moduleDimTermBar}
          />
          <line
            x1={x2 - ux * barOffset - nx * barHalf}
            y1={y2 - uy * barOffset - ny * barHalf}
            x2={x2 - ux * barOffset + nx * barHalf}
            y2={y2 - uy * barOffset + ny * barHalf}
            className={styles.moduleDimTermBar}
          />
        </>
      ) : null}
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

function PlanSvg({
  model,
  detailMode,
  idBase,
  consistency,
}: {
  model: ModulePlanModel;
  detailMode: ModuleDetailMode;
  idBase: string;
  consistency: GeometryConsistency | null;
}) {
  const diagnostic = detailMode === 'diagnostic';
  const technical = detailMode === 'technical' || diagnostic;
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
  const memberW = clamp(model.rafterWidthM * scale, 0.6, 2.8);
  const gutterW = clamp(model.gutterWidthM * scale, 0.8, 3.8);
  const rafterW = clamp(model.rafterWidthM * scale, 0.45, 1.9);

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
  const hipInner = isHipCorner ? hipCornerInnerPoints(x, y, aW, bW, splitY, bottomY, memberW) : null;

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

  const yTopInner = y + memberW;
  const yBottomInner = y + aH - gutterW;
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0.3, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - memberW * 2))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : y + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - memberW * 2);
  const overhangX = x + memberW;
  const viewLengthA = aW / scale;
  const viewSpanA = aH / scale;
  const viewOverhangM = model.overhangEnabled ? overhangDepth / scale : 0;
  const viewRafterSpacingA =
    rafterXsA.length >= 2
      ? (rafterXsA[rafterXsA.length - 1]! - rafterXsA[0]!) / (rafterXsA.length - 1) / scale
      : model.rafterSpacingA;
  const diagLines = [
    `Source: ${model.dataSource === 'derived' ? 'derived' : 'input fallback'}`,
    `A: ${formatMetres(model.lengthA)} x ${formatMetres(model.spanA)}`,
    `Rafters: ${model.rafterCountA} @ ${formatMetres(model.rafterSpacingA)} c/c`,
    `Max c/c: ${formatMetres(model.rafterMaxSpacingM)}`,
    `Overhang: ${model.overhangEnabled ? formatMetres(model.overhangAmountM) : 'off'}`,
    `Checks: ${consistency?.level === 'warn' ? `WARN (${consistency.details.length})` : 'OK'}`,
  ];
  const planDeltaRows: DeltaRow[] = [
    { metric: 'A length', engine: model.lengthA, view: viewLengthA, tolerance: 0.01, unit: 'm' },
    { metric: 'A span', engine: model.spanA, view: viewSpanA, tolerance: 0.01, unit: 'm' },
    { metric: 'Overhang', engine: model.overhangEnabled ? model.overhangAmountM : 0, view: viewOverhangM, tolerance: 0.02, unit: 'm' },
    { metric: 'Rafter c/c', engine: model.rafterSpacingA, view: viewRafterSpacingA, tolerance: 0.01, unit: 'm' },
  ];

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
      {!isHipCorner ? (
        <>
          <rect x={x} y={y} width={aW} height={memberW} className={styles.modulePlanMemberBand} />
          <rect x={x} y={y + aH - gutterW} width={aW} height={gutterW} className={styles.modulePlanMemberBand} />
          <rect x={x} y={y + memberW} width={memberW} height={Math.max(0.2, aH - memberW - gutterW)} className={styles.modulePlanMemberBand} />
          <rect x={x + aW - memberW} y={y + memberW} width={memberW} height={Math.max(0.2, aH - memberW - gutterW)} className={styles.modulePlanMemberBand} />
        </>
      ) : (
        <>
          <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanPerimeter} />
          {hipInner ? <polygon points={toPointsAttr(hipInner)} className={styles.modulePlanPerimeter} /> : null}
        </>
      )}

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
        ? rafterXsA.map((rx) => (
            <g key={`rafter_a_${rx.toFixed(3)}`}>
              <line x1={rx - rafterW / 2} y1={yTopInner} x2={rx - rafterW / 2} y2={isHipCorner ? splitY - gutterW : yBottomInner} className={styles.modulePlanRafter} />
              <line x1={rx + rafterW / 2} y1={yTopInner} x2={rx + rafterW / 2} y2={isHipCorner ? splitY - gutterW : yBottomInner} className={styles.modulePlanRafter} />
            </g>
          ))
        : null}

      {technical && isHipCorner
        ? rafterXsB.map((rx) => (
            <g key={`rafter_b_${rx.toFixed(3)}`}>
              <line x1={rx - rafterW / 2} y1={splitY + memberW} x2={rx - rafterW / 2} y2={bottomY - gutterW} className={styles.modulePlanRafter} />
              <line x1={rx + rafterW / 2} y1={splitY + memberW} x2={rx + rafterW / 2} y2={bottomY - gutterW} className={styles.modulePlanRafter} />
            </g>
          ))
        : null}

      {technical && model.houseConnectionType === 'soffit' && soffitXs.length > 0 ? (
        <>
          <line x1={soffitXs[0]} y1={y - 1.2} x2={soffitXs[soffitXs.length - 1]} y2={y - 1.2} className={styles.modulePlanSoffitGuide} />
          {soffitXs.map((sx) => (
            <line key={`bracket_${sx.toFixed(3)}`} x1={sx} y1={y - 2.3} x2={sx} y2={y + 0.1} className={styles.modulePlanSoffitBracket} />
          ))}
        </>
      ) : null}

      {model.overhangEnabled && overhangDepth > 0 ? <rect x={overhangX} y={overhangY} width={overhangWidth} height={overhangDepth} className={styles.modulePlanOverhangZone} /> : null}

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

      <line x1={x} y1={isHipCorner ? bottomY : y + aH} x2={x} y2={dimBaseY} className={styles.moduleDimWitness} />
      <line x1={x + aW} y1={isHipCorner ? splitY : y + aH} x2={x + aW} y2={dimBaseY} className={styles.moduleDimWitness} />
      <TickDimension x1={x} y1={dimBaseY} x2={x + aW} y2={dimBaseY} label={formatMetres(model.lengthA)} />

      <line x1={x} y1={y} x2={x - 6.2} y2={y} className={styles.moduleDimWitness} />
      <line x1={x} y1={y + aH} x2={x - 6.2} y2={y + aH} className={styles.moduleDimWitness} />
      <TickDimension x1={x - 6.2} y1={y} x2={x - 6.2} y2={y + aH} label={formatMetres(model.spanA)} />

      {isHipCorner && model.lengthB && model.spanB ? (
        <>
          <line x1={x} y1={bottomY} x2={x} y2={Math.min(88, dimBaseY + 4.8)} className={styles.moduleDimWitness} />
          <line x1={x + bW} y1={bottomY} x2={x + bW} y2={Math.min(88, dimBaseY + 4.8)} className={styles.moduleDimWitness} />
          <TickDimension x1={x} y1={Math.min(88, dimBaseY + 4.8)} x2={x + bW} y2={Math.min(88, dimBaseY + 4.8)} label={formatMetres(model.lengthB)} />

          <line x1={x + bW} y1={splitY} x2={x + bW + 6.2} y2={splitY} className={styles.moduleDimWitness} />
          <line x1={x + bW} y1={bottomY} x2={x + bW + 6.2} y2={bottomY} className={styles.moduleDimWitness} />
          <TickDimension x1={x + bW + 6.2} y1={splitY} x2={x + bW + 6.2} y2={bottomY} label={formatMetres(model.spanB)} />
        </>
      ) : null}

      {technical && rafterXsA.length >= 2 ? (() => {
        const baseIdx = Math.max(0, Math.floor((rafterXsA.length - 2) / 2));
        const d1 = rafterXsA[baseIdx]!;
        const d2 = rafterXsA[baseIdx + 1]!;
        return (
          <>
            <line x1={d1} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d1} y2={rafterDimY} className={styles.moduleDimWitness} />
            <line x1={d2} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d2} y2={rafterDimY} className={styles.moduleDimWitness} />
            <TickDimension x1={d1} y1={rafterDimY} x2={d2} y2={rafterDimY} label={`${formatMetres(model.rafterSpacingA)} c/c`} textY={rafterDimY - 1.3} />
          </>
        );
      })() : null}

      {diagnostic ? <DiagnosticsOverlay title="Plan Diagnostics" lines={diagLines} level={consistency?.level ?? 'ok'} /> : null}
      {diagnostic ? <DeltaTableOverlay title="Plan Delta (engine vs view)" rows={planDeltaRows} /> : null}
    </svg>
  );
}

function SectionSvg({
  model,
  detailMode,
  consistency,
}: {
  model: ModuleSectionModel;
  detailMode: ModuleDetailMode;
  consistency: GeometryConsistency | null;
}) {
  const diagnostic = detailMode === 'diagnostic';
  const technical = detailMode === 'technical' || diagnostic;
  const overhangM = sectionOverhangM(model);
  const totalSpanM = Math.max(model.spanA, 0.001);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const ledgerBeamDepthM = sectionLedgerBeamDepthM(model);
  const ledgerBeamWidthM = sectionLedgerBeamWidthM(model);
  const supportBeamDepthM = sectionSupportBeamDepthM(model);
  const supportBeamWidthM = sectionSupportBeamWidthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const ridgeBeamWidthM = sectionRidgeBeamWidthM(model);
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? ledgerBeamDepthM : supportBeamDepthM;
  const rightEaveBeamWidthM = model.sectionKind === 'gable' ? ledgerBeamWidthM : supportBeamWidthM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const supportUndersideM = sectionSupportUndersideM(model);
  const monoRightRole = model.sectionKind === 'mono' ? sectionMonoRightEdgeRole(model) : null;
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + ledgerBeamDepthM;
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM;
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM;
  const supportBeamTopM = supportUndersideM + supportBeamDepthM;

  const chartWidth = 84;
  const topMargin = 16;
  const yGround = 72;
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

  const availableHeight = Math.max(10, yGround - topMargin);
  const scaleX = chartWidth / safeSpanM;
  const scaleY = availableHeight / maxHeightM;
  const scale = Math.min(scaleX, scaleY);

  const postW = clamp(model.rafterWidthM * scale, 0.9, 2.8);
  const rafterDepth = clamp(model.rafterDepthM * scale, 1.1, 6.4);
  const gutterWidth = clamp(model.gutterWidthM * scale, 0.9, 4.4);
  const ledgerDepth = clamp(ledgerBeamDepthM * scale, 0.9, 5.4);
  const ledgerWidth = clamp(ledgerBeamWidthM * scale, 0.8, 3.8);
  const supportCapDepth = clamp(supportBeamDepthM * scale, 0.9, 5.4);
  const supportCapWidth = clamp(supportBeamWidthM * scale, 0.8, 3.8);
  const rightEaveBeamDepth = clamp(rightEaveBeamDepthM * scale, 0.9, 5.4);
  const rightEaveBeamWidth = clamp(rightEaveBeamWidthM * scale, 0.8, 3.8);
  const ridgeBeamDepth = clamp(ridgeBeamDepthM * scale, 0.9, 5.4);
  const ridgeBeamWidth = clamp(ridgeBeamWidthM * scale, 0.8, 3.8);

  const drawWidth = safeSpanM * scale;
  const xLeft = (120 - drawWidth) / 2;
  const xRight = xLeft + model.spanA * scale;
  const xSupport = model.sectionKind === 'mono' ? xLeft + supportXFromHouseM * scale : xRight;
  const ridgeX = (xLeft + xRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;

  const yHouseUnder = yForHeight(houseLedgerUndersideM);
  const ySupportUnder = yForHeight(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM);
  const yOuterGutterUnder = yForHeight(outerGutterUndersideM);
  const yHouseRafterUnder = yForHeight(houseRafterUndersideM);
  const yOuterRafterUnder = yForHeight(outerRafterUndersideM);
  const ySupportBeamTop = yForHeight(supportBeamTopM);
  const yRidgeUnder = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;
  const yRidgeBeamTop = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM + ridgeBeamDepthM) : null;
  const supportPostTopY = ySupportUnder;
  const supportCapTopY = ySupportBeamTop;
  const gutterTopY = yOuterRafterUnder;
  const ledgerX = model.sectionKind === 'gable' ? xLeft - ledgerWidth / 2 : xLeft - postW / 2;
  const ledgerY = yForHeight(houseLedgerUndersideM + ledgerBeamDepthM);
  const rightEaveX = xRight - rightEaveBeamWidth / 2;
  const rightEaveY = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM);

  const leftDimX = Math.max(6, xLeft - 7.4);
  const rightDimX = Math.min(114, xRight + 8.2);
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = Math.min(88.5, Math.max(yGround + 9.0, spanDatumY + 7.4));
  const overhangDimY = Math.max(spanAnchorRightY + 3.8, spanDimY - 4.8);

  const mainRoofNormal = segmentDownNormal(xLeft, yHouseRafterUnder, xRight, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;

  const monoRoofGeom =
    model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(xLeft, yHouseRafterUnder, xRight, yOuterRafterUnder, rafterDepth) : null;

  const gableLeftRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(xLeft, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth);
  })();

  const gableRightRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, xRight, yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM), rafterDepth);
  })();

  const monoSupportSplice = (() => {
    if (model.sectionKind !== 'mono' || overhangM <= 0 || !monoRoofGeom || xRight - xLeft <= 1e-6) return null;
    const t = clamp((xSupport - xLeft) / (xRight - xLeft), 0, 1);
    const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
    const topStart = monoRoofGeom.points[3]!;
    const topEnd = monoRoofGeom.points[2]!;
    const yTop = topStart.y + (topEnd.y - topStart.y) * t;
    return { yTop, yUnder };
  })();

  const impliedPitchDeg =
    model.sectionKind === 'mono' && model.spanA > 0
      ? (Math.atan(Math.abs(outerRafterUndersideM - houseRafterUndersideM) / model.spanA) * 180) / Math.PI
      : model.pitchDeg;
  const supportEngineDatumM =
    model.sectionKind === 'mono' && overhangM > 0 && monoRightRole === 'support' ? model.rightEdgeHeightM : supportUndersideM;
  const rawRightDatumViewM =
    model.sectionKind === 'mono' && overhangM > 0 && monoRightRole === 'support' ? (yGround - ySupportUnder) / scale : (yGround - yOuterGutterUnder) / scale;
  const diagLines = [
    `Source: ${model.dataSource === 'derived' ? 'derived' : 'input fallback'}`,
    `Span: ${formatMetres(model.spanA)} | support at: ${formatMetres(supportXFromHouseM)}`,
    `Overhang: ${overhangM > 0 ? formatMetres(overhangM) : 'off'}`,
    ...(model.sectionKind === 'mono' && overhangM > 0 ? [`Right datum role: ${monoRightRole === 'support' ? 'support post' : 'outer gutter'}`] : []),
    `Ledger U/S: ${formatMetres(houseLedgerUndersideM)} | Support U/S: ${formatMetres(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM)}`,
    `Outer gutter U/S: ${formatMetres(outerGutterUndersideM)}`,
    `Pitch: ${model.pitchDeg.toFixed(2)} deg | implied: ${impliedPitchDeg.toFixed(2)} deg`,
    `Checks: ${consistency?.level === 'warn' ? `WARN (${consistency.details.length})` : 'OK'}`,
  ];
  const sectionDeltaRows: DeltaRow[] = [
    { metric: 'Span', engine: model.spanA, view: (xRight - xLeft) / scale, tolerance: 0.01, unit: 'm' },
    { metric: 'Support position', engine: supportXFromHouseM, view: (xSupport - xLeft) / scale, tolerance: 0.01, unit: 'm' },
    { metric: 'Overhang', engine: overhangM, view: (xRight - xSupport) / scale, tolerance: 0.01, unit: 'm' },
    { metric: 'Pitch', engine: model.pitchDeg, view: impliedPitchDeg, tolerance: 0.1, unit: 'deg' },
    { metric: 'Ledger U/S', engine: houseLedgerUndersideM, view: (yGround - yHouseUnder) / scale, tolerance: 0.01, unit: 'm' },
    { metric: 'Support U/S', engine: model.sectionKind === 'mono' ? supportEngineDatumM : model.rightEdgeHeightM, view: (yGround - ySupportUnder) / scale, tolerance: 0.01, unit: 'm' },
    { metric: 'Outer gutter U/S', engine: outerGutterUndersideM, view: (yGround - yOuterGutterUnder) / scale, tolerance: 0.01, unit: 'm' },
    ...(model.sectionKind === 'mono' && overhangM > 0
      ? [{ metric: 'Right datum raw', engine: model.rightEdgeHeightM, view: rawRightDatumViewM, tolerance: 0.01, unit: 'm' as const }]
      : []),
    { metric: 'Ledger beam depth', engine: ledgerBeamDepthM, view: ledgerDepth / scale, tolerance: 0.005, unit: 'm' },
    ...(model.sectionKind === 'mono'
      ? [{ metric: 'Support beam depth', engine: supportBeamDepthM, view: supportCapDepth / scale, tolerance: 0.005, unit: 'm' as const }]
      : [{ metric: 'Eave beam depth', engine: rightEaveBeamDepthM, view: rightEaveBeamDepth / scale, tolerance: 0.005, unit: 'm' as const }]),
    ...(model.sectionKind === 'gable'
      ? [{ metric: 'Ridge beam depth', engine: ridgeBeamDepthM, view: ridgeBeamDepth / scale, tolerance: 0.005, unit: 'm' as const }]
      : []),
  ];

  const depthDimUnderX = xLeft + (xRight - xLeft) * 0.24;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * 0.24;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };

  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="Module section view" className={styles.modulePlanSvg}>
      <rect x={Math.max(8, xLeft - 8)} y={yGround + 1.3} width={Math.min(104, xRight + 8) - Math.max(8, xLeft - 8)} height={8} className={styles.moduleSectionGroundFill} />
      <line x1={Math.max(8, xLeft - 8)} y1={yGround} x2={Math.min(112, xRight + 8)} y2={yGround} className={styles.moduleSectionGround} />

      {diagnostic ? (
        <>
          <line x1={Math.max(8, xLeft - 7)} y1={yHouseUnder} x2={Math.min(112, xRight + 7)} y2={yHouseUnder} className={styles.moduleDiagDatum} />
          <text x={Math.max(8, xLeft - 6.6)} y={yHouseUnder - 0.9} className={styles.moduleDiagDatumLabel}>
            ledger underside datum
          </text>
          <line x1={Math.max(8, xLeft - 7)} y1={ySupportUnder} x2={Math.min(112, xRight + 7)} y2={ySupportUnder} className={styles.moduleDiagDatum} />
          <text x={Math.max(8, xLeft - 6.6)} y={ySupportUnder - 0.9} className={styles.moduleDiagDatumLabel}>
            support underside datum
          </text>
          <line x1={Math.max(8, xLeft - 7)} y1={yOuterGutterUnder} x2={Math.min(112, xRight + 7)} y2={yOuterGutterUnder} className={styles.moduleDiagDatum} />
          <text x={Math.max(8, xLeft - 6.6)} y={yOuterGutterUnder - 0.9} className={styles.moduleDiagDatumLabel}>
            gutter underside datum
          </text>
        </>
      ) : null}

      <rect x={xLeft - postW / 2} y={yHouseUnder} width={postW} height={yGround - yHouseUnder} className={styles.moduleSectionMember} />
      <rect x={xSupport - postW / 2} y={supportPostTopY} width={postW} height={yGround - supportPostTopY} className={styles.moduleSectionMember} />
      <rect x={ledgerX} y={ledgerY} width={ledgerWidth} height={ledgerDepth} className={styles.moduleSectionLedger} />
      {model.sectionKind === 'mono' && overhangM > 0 ? (
        <rect x={xSupport - supportCapWidth / 2} y={supportCapTopY} width={supportCapWidth} height={supportCapDepth} className={styles.moduleSectionOverhangBeam} />
      ) : model.sectionKind === 'gable' ? (
        <rect x={rightEaveX} y={rightEaveY} width={rightEaveBeamWidth} height={rightEaveBeamDepth} className={styles.moduleSectionLedger} />
      ) : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? <line x1={ridgeX} y1={yGround} x2={ridgeX} y2={yRidgeUnder} className={styles.moduleSectionPostGhost} /> : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
        <>
          {gableLeftRoofGeom ? <polygon points={toPointsAttr(gableLeftRoofGeom.points)} className={styles.moduleSectionMember} /> : null}
          {gableRightRoofGeom ? <polygon points={toPointsAttr(gableRightRoofGeom.points)} className={styles.moduleSectionMember} /> : null}
          {yRidgeBeamTop !== null ? (
            <rect
              x={ridgeX - ridgeBeamWidth / 2}
              y={yRidgeBeamTop ?? yRidgeUnder}
              width={ridgeBeamWidth}
              height={Math.max(0.2, yRidgeUnder - (yRidgeBeamTop ?? yRidgeUnder))}
              className={styles.moduleSectionLedger}
            />
          ) : null}
        </>
      ) : (
        <>
          {monoRoofGeom ? <polygon points={toPointsAttr(monoRoofGeom.points)} className={styles.moduleSectionMember} /> : null}
        </>
      )}

      {monoSupportSplice ? (
        <line
          x1={xSupport}
          y1={monoSupportSplice.yTop}
          x2={xSupport}
          y2={monoSupportSplice.yUnder}
          className={styles.moduleSectionMember}
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

      {model.boxPerimeterEnabled ? (
        <>
          {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
            <>
              <line x1={xLeft + 2.4} y1={yHouseRafterUnder + 1.4} x2={ridgeX} y2={yRidgeUnder + 1.4} className={styles.moduleSectionBoxRoof} />
              <line
                x1={ridgeX}
                y1={yRidgeUnder + 1.4}
                x2={xRight - 2.4}
                y2={yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM) + 1.4}
                className={styles.moduleSectionBoxRoof}
              />
            </>
          ) : (
            <line x1={xLeft + 2.4} y1={yHouseRafterUnder + 1.4} x2={xRight - 2.4} y2={yOuterRafterUnder + 1.4} className={styles.moduleSectionBoxRoof} />
          )}
          {technical ? (
            <text x={(xLeft + xRight) / 2} y={Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8)} textAnchor="middle" className={styles.moduleSectionAngleLabel}>
              {`Internal roof angle ${model.pitchDeg.toFixed(1)} deg`}
            </text>
          ) : null}
        </>
      ) : null}

      {technical && model.sectionKind === 'mono' ? (
        <TickDimension
          x1={depthDimTop.x}
          y1={depthDimTop.y}
          x2={depthDimBottom.x}
          y2={depthDimBottom.y}
          label={`${Math.round(model.rafterDepthM * 1000)}mm`}
          textY={depthDimTop.y - 1.6}
          overrun={1.1}
        />
      ) : null}

      <line x1={leftDimX - 2.4} y1={yHouseUnder} x2={xLeft + 2.4} y2={yHouseUnder} className={styles.moduleDimGuide} />
      <line x1={xRight - 2.4} y1={yOuterGutterUnder} x2={rightDimX + 2.4} y2={yOuterGutterUnder} className={styles.moduleDimGuide} />

      {overhangM > 0 ? (
        <>
          <line x1={xSupport} y1={spanAnchorSupportY} x2={xSupport} y2={overhangDimY} className={styles.moduleDimWitness} />
          <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={overhangDimY} className={styles.moduleDimWitness} />
          <TickDimension x1={xSupport} y1={overhangDimY} x2={xRight} y2={overhangDimY} label={`OH ${formatMetres(overhangM)}`} />
        </>
      ) : null}

      <line x1={xLeft} y1={spanAnchorLeftY} x2={xLeft} y2={spanDimY} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={spanDimY} className={styles.moduleDimWitness} />
      <TickDimension x1={xLeft} y1={spanDimY} x2={xRight} y2={spanDimY} label={formatMetres(model.spanA)} textY={spanDimY - 1.4} />

      <line x1={xLeft - postW / 2} y1={yGround} x2={leftDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xLeft - postW / 2} y1={yHouseUnder} x2={leftDimX} y2={yHouseUnder} className={styles.moduleDimWitness} />
      <TickDimension x1={leftDimX} y1={yGround} x2={leftDimX} y2={yHouseUnder} label={formatMetres(model.leftEdgeHeightM)} />

      <line x1={xRight} y1={yGround} x2={rightDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={yOuterGutterUnder} x2={rightDimX} y2={yOuterGutterUnder} className={styles.moduleDimWitness} />
      <TickDimension x1={rightDimX} y1={yGround} x2={rightDimX} y2={yOuterGutterUnder} label={formatMetres(outerGutterUndersideM)} />

      <text x={(xLeft + xRight) / 2} y={88} textAnchor="middle" className={styles.moduleSectionPitchLabel}>
        {`Pitch ${model.pitchDeg.toFixed(1)} deg`}
      </text>

      {model.roofType === 'hip_corner' ? (
        <text x={(xLeft + xRight) / 2} y={84.8} textAnchor="middle" className={styles.moduleSectionMetaLabel}>
          Primary wing section (A)
        </text>
      ) : null}

      {diagnostic ? <DiagnosticsOverlay title="Section Diagnostics" lines={diagLines} level={consistency?.level ?? 'ok'} /> : null}
      {diagnostic ? <DeltaTableOverlay title="Section Delta (engine vs view)" rows={sectionDeltaRows} /> : null}
    </svg>
  );
}
