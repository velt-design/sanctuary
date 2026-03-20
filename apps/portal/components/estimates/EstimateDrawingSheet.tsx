'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getSuggestedModuleDrawingScale, ModuleDrawingRenderer, resolveModuleDrawingScaleState } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import drawingStyles from '@/app/staff/calculator/CalculatorGrid.module.css';
import { PORTAL_COMPANY_PROFILE } from '@/lib/company/profile';
import {
  estimateDrawingScaleKey,
  formatEstimateDrawingScale,
  getEstimateDrawingScaleOptions,
  parseEstimateDrawingScaleKey,
  type EstimateDrawingScale,
  type EstimateDrawingSheetMeta,
} from '@/lib/estimates/drawingSheet';
import { getDrawingSheetViewportMm } from '@/lib/estimates/drawingSheetLayout';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import styles from './EstimateDrawingSheet.module.css';

type LegendSourceClass =
  | 'modulePlanPerimeter'
  | 'modulePlanMemberEdge'
  | 'modulePlanRafter'
  | 'modulePlanSoffitBracket'
  | 'moduleSectionPrimaryBeam'
  | 'moduleSectionRoofMember'
  | 'moduleSectionRidgeBeam'
  | 'moduleSectionTieBeamPrimary'
  | 'moduleSectionConnection'
  | 'moduleDimLine'
  | 'moduleDimTick';

type EstimateDrawingSheetProps = {
  moduleLabel: string;
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  meta: EstimateDrawingSheetMeta;
};

type LegendItem = {
  label: string;
  sample: 'line' | 'dimension';
  sourceClass: LegendSourceClass;
  accentClass?: LegendSourceClass;
  sampleKey: string;
};

type EstimateDrawingSheetScaleState = Record<ModuleViewsTab, EstimateDrawingScale>;

const SHEET_VIEWPORT_MM = getDrawingSheetViewportMm();
const SHEET_PREVIEW_ARTBOARD = {
  widthPx: 1120,
  heightPx: 792,
} as const;

function stripClientFacingModulePrefix(value: string): string {
  return value.replace(/^\s*M\d+\s*-\s*/i, '').trim();
}

function buildScaleState(
  planModel?: ModulePlanModel | null,
  sectionModel?: ModuleSectionModel | null,
): EstimateDrawingSheetScaleState {
  return {
    plan: getSuggestedModuleDrawingScale({ view: 'plan', planModel, sectionModel, viewportMm: SHEET_VIEWPORT_MM }),
    section: getSuggestedModuleDrawingScale({ view: 'section', planModel, sectionModel, viewportMm: SHEET_VIEWPORT_MM }),
  };
}

function buildLegendItems(
  view: ModuleViewsTab,
  planModel?: ModulePlanModel | null,
  sectionModel?: ModuleSectionModel | null,
): LegendItem[] {
  if (view === 'plan') {
    const items: LegendItem[] = [
      { label: 'Primary structure', sample: 'line', sourceClass: 'modulePlanPerimeter', sampleKey: 'primary' },
      { label: 'Roof framing', sample: 'line', sourceClass: 'modulePlanMemberEdge', sampleKey: 'secondary' },
      { label: 'Roof field', sample: 'line', sourceClass: 'modulePlanRafter', sampleKey: 'tertiary' },
    ];
    if (planModel?.houseConnectionType === 'soffit') {
      items.push({ label: 'Soffit brackets', sample: 'line', sourceClass: 'modulePlanSoffitBracket', sampleKey: 'annotation' });
    }
    items.push({ label: 'Dimensions', sample: 'dimension', sourceClass: 'moduleDimLine', accentClass: 'moduleDimTick', sampleKey: 'dimension' });
    return items;
  }

  const items: LegendItem[] = [
    { label: 'Primary structure', sample: 'line', sourceClass: 'moduleSectionPrimaryBeam', sampleKey: 'primary' },
  ];
  if (sectionModel?.sectionKind === 'gable') {
    items.push({ label: 'Ridge beam', sample: 'line', sourceClass: 'moduleSectionRidgeBeam', sampleKey: 'ridge' });
    items.push({ label: 'Tie beam', sample: 'line', sourceClass: 'moduleSectionTieBeamPrimary', sampleKey: 'tie' });
  }
  items.push({ label: 'Roof members', sample: 'line', sourceClass: 'moduleSectionRoofMember', sampleKey: 'secondary' });
  items.push({ label: 'Datum / guide', sample: 'line', sourceClass: 'moduleSectionConnection', sampleKey: 'guide' });
  items.push({ label: 'Dimensions', sample: 'dimension', sourceClass: 'moduleDimLine', accentClass: 'moduleDimTick', sampleKey: 'dimension' });
  return items;
}

function LegendSample({ item }: { item: LegendItem }) {
  const className = drawingStyles[item.sourceClass];
  const accentClassName = item.accentClass ? drawingStyles[item.accentClass] : null;

  if (item.sample === 'dimension') {
    return (
      <svg
        className={styles.legendSwatchSvg}
        viewBox="0 0 24 8"
        aria-hidden="true"
        data-legend-sample={item.sampleKey}
        data-source-class={item.sourceClass}
      >
        <line x1="2" y1="4" x2="22" y2="4" className={className} />
        <line x1="4" y1="2.45" x2="2.55" y2="5.55" className={accentClassName ?? className} />
        <line x1="21.45" y1="2.45" x2="20" y2="5.55" className={accentClassName ?? className} />
      </svg>
    );
  }

  return (
    <svg
      className={styles.legendSwatchSvg}
      viewBox="0 0 24 8"
      aria-hidden="true"
      data-legend-sample={item.sampleKey}
      data-source-class={item.sourceClass}
    >
      <line x1="1" y1="4" x2="23" y2="4" className={className} />
    </svg>
  );
}

function splitNoteLines(note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\.\s+/)
    .map((line, index, parts) => (index < parts.length - 1 && !line.endsWith('.') ? `${line}.` : line))
    .filter(Boolean);
}

export default function EstimateDrawingSheet({
  moduleLabel,
  view,
  status,
  planModel,
  sectionModel,
  meta,
}: EstimateDrawingSheetProps) {
  const sheetViewportRef = useRef<HTMLDivElement | null>(null);
  const [availableWidthPx, setAvailableWidthPx] = useState(0);
  const [selectedScales, setSelectedScales] = useState<EstimateDrawingSheetScaleState>(() => buildScaleState(planModel, sectionModel));
  const viewLabel = view === 'plan' ? 'Plan view' : 'Section view';
  const clientFacingModuleLabel = stripClientFacingModulePrefix(moduleLabel);
  const legendItems = buildLegendItems(view, planModel, sectionModel);
  const noteLines = splitNoteLines(meta.note);
  const scaleOptions = getEstimateDrawingScaleOptions(view).map((option) => ({
    value: estimateDrawingScaleKey(option),
    label: option.mode === 'fit' ? 'Fit / NTS' : formatEstimateDrawingScale(option),
    disabled:
      option.mode === 'fixed' &&
      !resolveModuleDrawingScaleState({
        view,
        requestedScale: option,
        planModel,
        sectionModel,
        viewportMm: SHEET_VIEWPORT_MM,
      }).fits,
  }));
  const currentScale = selectedScales[view];
  const currentScaleState = resolveModuleDrawingScaleState({
    view,
    requestedScale: currentScale,
    planModel,
    sectionModel,
    viewportMm: SHEET_VIEWPORT_MM,
  });
  const scaleDisplay = formatEstimateDrawingScale(currentScaleState.appliedScale);
  const scaleWarning =
    currentScaleState.requestedScale.mode === 'fixed' && !currentScaleState.fits
      ? `Selected ${formatEstimateDrawingScale(currentScaleState.requestedScale)} exceeds the A3 drawing area. Using ${formatEstimateDrawingScale(currentScaleState.appliedScale)} preview.`
      : null;
  const titleMetaItems = [
    { label: 'Sheet', value: meta.sheetCode },
    { label: 'Revision', value: meta.revision },
    { label: 'Scale', value: scaleDisplay },
    { label: 'Date', value: meta.date },
  ];
  const footerMetaItems = [
    { label: 'Client', value: meta.client },
    { label: 'Issue', value: meta.issue },
  ];
  const noteDisplayLines = noteLines.length ? noteLines : [meta.note];
  const clientFacingDrawingTitle = stripClientFacingModulePrefix(meta.drawingTitle);
  const previewScale = availableWidthPx > 0 ? Math.min(availableWidthPx / SHEET_PREVIEW_ARTBOARD.widthPx, 1) : 1;
  const previewHeightPx = Math.round(SHEET_PREVIEW_ARTBOARD.heightPx * previewScale);
  const viewportStyle = {
    '--sheet-preview-scale': `${previewScale}`,
    '--sheet-preview-height': `${previewHeightPx}px`,
  } as CSSProperties;

  useEffect(() => {
    const node = sheetViewportRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      setAvailableWidthPx(Math.round(node.getBoundingClientRect().width));
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scaleResetKey = useMemo(
    () =>
      [
        moduleLabel,
        planModel?.roofType ?? '-',
        planModel?.lengthA ?? '-',
        planModel?.spanA ?? '-',
        planModel?.lengthB ?? '-',
        planModel?.spanB ?? '-',
        sectionModel?.sectionKind ?? '-',
        sectionModel?.spanA ?? '-',
        sectionModel?.leftEdgeHeightM ?? '-',
        sectionModel?.rightEdgeHeightM ?? '-',
        sectionModel?.ridgeHeightM ?? '-',
      ].join('|'),
    [
      moduleLabel,
      planModel?.roofType,
      planModel?.lengthA,
      planModel?.spanA,
      planModel?.lengthB,
      planModel?.spanB,
      sectionModel?.sectionKind,
      sectionModel?.spanA,
      sectionModel?.leftEdgeHeightM,
      sectionModel?.rightEdgeHeightM,
      sectionModel?.ridgeHeightM,
    ],
  );

  useEffect(() => {
    setSelectedScales(buildScaleState(planModel, sectionModel));
  }, [scaleResetKey]);

  return (
    <div className={styles.sheetShell}>
      <div ref={sheetViewportRef} className={styles.sheetViewport} style={viewportStyle}>
        <div className={styles.sheetStage}>
          <section className={styles.sheetPaper} style={moduleDrawingThemeCssVariables('sheet')} aria-label={`${viewLabel} A3 drawing sheet`}>
            <div className={styles.sheetUpper}>
              <div className={styles.sheetHeader}>
                <div className={styles.sheetHeaderCopy}>
                  <div className={styles.sheetEyebrow}>{viewLabel}</div>
                  <div className={styles.sheetModuleLabel}>{clientFacingModuleLabel}</div>
                </div>
                <div className={styles.sheetHeaderRule} aria-hidden="true" />
              </div>

              <div className={styles.sheetInfoRail}>
                <label className={styles.sheetScaleBox}>
                  <span className={styles.scaleKicker}>Scale</span>
                  <select
                    className={styles.scaleSelect}
                    aria-label="Drawing scale"
                    value={estimateDrawingScaleKey(currentScale)}
                    onChange={(event) => {
                      const nextScale = parseEstimateDrawingScaleKey(event.target.value);
                      setSelectedScales((prev) => ({ ...prev, [view]: nextScale }));
                    }}
                  >
                    {scaleOptions.map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {scaleWarning ? <span className={styles.scaleWarning}>{scaleWarning}</span> : null}
                </label>

                <aside className={styles.legendBox} aria-label="Drawing legend">
                  <div className={styles.legendTitle}>Legend</div>
                  <div className={styles.legendList}>
                    {legendItems.map((item) => (
                      <div key={item.label} className={styles.legendItem}>
                        <LegendSample item={item} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>

              <div className={styles.drawingViewport}>
                <ModuleDrawingRenderer
                  key={view}
                  view={view}
                  status={status}
                  planModel={planModel}
                  sectionModel={sectionModel}
                  presentation="sheet"
                  drawingScale={currentScale}
                  sheetViewportMm={SHEET_VIEWPORT_MM}
                />
              </div>
            </div>

            <footer className={styles.sheetFooter}>
              <div className={styles.companyBlock}>
                <div className={styles.companyName}>{PORTAL_COMPANY_PROFILE.name}</div>
                <div className={styles.companyLine}>{PORTAL_COMPANY_PROFILE.addressLines.join(', ')}</div>
                <div className={styles.companyLine}>{`${PORTAL_COMPANY_PROFILE.phone}  |  ${PORTAL_COMPANY_PROFILE.email}`}</div>
              </div>

              <div className={styles.noteBlock}>
                <span className={styles.noteLabel}>Note</span>
                <span className={styles.noteCopy}>
                  {noteDisplayLines.map((line, index) => (
                    <span key={`${line}-${index}`} className={styles.noteLine}>
                      {line}
                    </span>
                  ))}
                </span>
              </div>

              <div className={styles.infoCluster}>
                <div className={styles.clusterTopRow}>
                  {titleMetaItems.map((item) => (
                    <div key={item.label} className={styles.clusterMetaPair}>
                      <span className={styles.blockLabel}>{item.label}</span>
                      <span className={styles.clusterMetaValue}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.titleInfoBlock}>
                  <div className={styles.blockValue}>{clientFacingDrawingTitle}</div>
                  <div className={styles.titleSubValue}>{meta.siteAddress}</div>
                </div>

                <div className={styles.clusterBottomRow}>
                  {footerMetaItems.map((item) => (
                    <div key={item.label} className={styles.metaCell}>
                      <span className={styles.blockLabel}>{item.label}</span>
                      <span className={styles.metaValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}
