'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestedModuleDrawingScale, ModuleDrawingRenderer, resolveModuleDrawingScaleState } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
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

type LegendTone = 'primary' | 'secondary' | 'annotation' | 'dimension' | 'hidden';

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
  tone: LegendTone;
};

type EstimateDrawingSheetScaleState = Record<ModuleViewsTab, EstimateDrawingScale>;

const SHEET_VIEWPORT_MM = getDrawingSheetViewportMm();

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
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
      { label: 'Frame perimeter', tone: 'primary' },
    ];
    if (planModel?.roofType === 'gable' || planModel?.roofType === 'low_gable') {
      items.push({ label: 'Ridge beam', tone: 'primary' });
    }
    items.push({ label: 'Rafters', tone: 'secondary' });
    if (planModel?.houseConnectionType === 'soffit') {
      items.push({ label: 'Soffit brackets', tone: 'annotation' });
    }
    items.push({ label: 'House side', tone: 'hidden' });
    items.push({ label: 'Dimensions', tone: 'dimension' });
    return items;
  }

  const hasOverhangSupport =
    sectionModel?.sectionKind === 'mono' && Boolean(sectionModel?.overhangEnabled) && (sectionModel?.overhangAmountM ?? 0) > 0;
  const items: LegendItem[] = [
    { label: 'Primary frame', tone: 'primary' },
  ];
  if (sectionModel?.sectionKind === 'gable') {
    items.push({ label: 'Ridge beam', tone: 'primary' });
  }
  items.push({ label: 'Roof members', tone: 'secondary' });
  if (sectionModel?.sectionKind === 'gable') {
    items.push({ label: 'Tie beam / king strut', tone: 'secondary' });
  }
  if (hasOverhangSupport) {
    items.push({ label: 'Overhang support', tone: 'primary' });
  }
  items.push({ label: 'Datum / guide', tone: 'hidden' });
  items.push({ label: 'Dimensions', tone: 'dimension' });
  return items;
}

function legendToneClassName(tone: LegendTone): string {
  switch (tone) {
    case 'secondary':
      return styles.legendSwatchSecondary;
    case 'annotation':
      return styles.legendSwatchAnnotation;
    case 'dimension':
      return styles.legendSwatchDimension;
    case 'hidden':
      return styles.legendSwatchHidden;
    default:
      return styles.legendSwatchPrimary;
  }
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
  const sheetPaperRef = useRef<HTMLElement | null>(null);
  const [sheetWidthPx, setSheetWidthPx] = useState(0);
  const [selectedScales, setSelectedScales] = useState<EstimateDrawingSheetScaleState>(() => buildScaleState(planModel, sectionModel));
  const viewLabel = view === 'plan' ? 'Plan view' : 'Section view';
  const legendItems = buildLegendItems(view, planModel, sectionModel);
  const noteLines = splitNoteLines(meta.note);
  const isCompactSheet = sheetWidthPx > 0 && sheetWidthPx < 760;
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
  const noteText = (noteLines.length ? noteLines : [meta.note]).join(' ');

  useEffect(() => {
    const node = sheetPaperRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      setSheetWidthPx(Math.round(node.getBoundingClientRect().width));
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
      <div className={styles.sheetScroller}>
        <section
          ref={sheetPaperRef}
          className={cx(styles.sheetPaper, isCompactSheet && styles.sheetPaperCompact)}
          style={moduleDrawingThemeCssVariables('sheet')}
          aria-label={`${viewLabel} A3 drawing sheet`}
        >
          <div className={styles.sheetUpper}>
            <div className={styles.sheetHeader}>
              <div className={styles.sheetHeaderCopy}>
                <div className={styles.sheetEyebrow}>{viewLabel}</div>
                <div className={styles.sheetModuleLabel}>{moduleLabel}</div>
              </div>
              <div className={styles.sheetHeaderRule} aria-hidden="true" />
            </div>

            <div className={cx(styles.sheetInfoRail, isCompactSheet && styles.sheetInfoRailCompact)}>
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

              <aside className={cx(styles.legendBox, isCompactSheet && styles.legendBoxCompact)} aria-label="Drawing legend">
                <div className={styles.legendTitle}>Legend</div>
                <div className={styles.legendList}>
                  {legendItems.map((item) => (
                    <div key={item.label} className={styles.legendItem}>
                      <span className={`${styles.legendSwatch} ${legendToneClassName(item.tone)}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>

            <div className={styles.drawingViewport}>
              <ModuleDrawingRenderer
                key={`${view}-${isCompactSheet ? 'compact' : 'wide'}`}
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

          <footer className={cx(styles.sheetFooter, isCompactSheet && styles.sheetFooterCompact)}>
            <div className={styles.companyBlock}>
              <div className={styles.companyName}>{PORTAL_COMPANY_PROFILE.name}</div>
              <div className={styles.companyLine}>{PORTAL_COMPANY_PROFILE.addressLines.join(', ')}</div>
              <div className={styles.companyLine}>{`${PORTAL_COMPANY_PROFILE.phone}  |  ${PORTAL_COMPANY_PROFILE.email}`}</div>
            </div>

            <div className={styles.noteBlock}>
              <span className={styles.noteLabel}>Note</span>
              <span className={styles.noteInline}>{noteText}</span>
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
                <div className={styles.blockValue}>{meta.drawingTitle}</div>
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
  );
}
