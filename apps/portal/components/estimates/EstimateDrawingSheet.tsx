'use client';

import { useEffect, useRef, useState } from 'react';
import { ModuleDrawingRenderer } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModuleViewsStatus, ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import { PORTAL_COMPANY_PROFILE } from '@/lib/company/profile';
import type { EstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import styles from './EstimateDrawingSheet.module.css';

type LegendTone = 'primary' | 'secondary' | 'dimension' | 'hidden';

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

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function buildLegendItems(
  view: ModuleViewsTab,
  planModel?: ModulePlanModel | null,
  sectionModel?: ModuleSectionModel | null,
): LegendItem[] {
  if (view === 'plan') {
    return [
      { label: 'Frame perimeter', tone: 'primary' },
      { label: 'Rafters', tone: 'secondary' },
      { label: planModel?.houseConnectionType === 'soffit' ? 'Soffit brackets' : 'House side', tone: 'hidden' },
      { label: 'Dimensions', tone: 'dimension' },
    ];
  }

  return [
    { label: 'Primary frame', tone: 'primary' },
    { label: sectionModel?.sectionKind === 'gable' ? 'Tie beam / ridge' : 'Roof line', tone: 'secondary' },
    { label: sectionModel?.overhangEnabled ? 'Support / datum' : 'Datum / guide', tone: 'hidden' },
    { label: 'Dimensions', tone: 'dimension' },
  ];
}

function legendToneClassName(tone: LegendTone): string {
  switch (tone) {
    case 'secondary':
      return styles.legendSwatchSecondary;
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
  const viewLabel = view === 'plan' ? 'Plan view' : 'Section view';
  const legendItems = buildLegendItems(view, planModel, sectionModel);
  const noteLines = splitNoteLines(meta.note);
  const isCompactSheet = sheetWidthPx > 0 && sheetWidthPx < 760;

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

  return (
    <div className={styles.sheetShell}>
      <div className={styles.sheetScroller}>
        <section
          ref={sheetPaperRef}
          className={cx(styles.sheetPaper, isCompactSheet && styles.sheetPaperCompact)}
          aria-label={`${viewLabel} A3 drawing sheet`}
        >
          <div className={styles.sheetUpper}>
            <div className={styles.sheetHeader}>
              <div>
                <div className={styles.sheetEyebrow}>{viewLabel}</div>
                <div className={styles.sheetModuleLabel}>{moduleLabel}</div>
              </div>
              <div className={styles.sheetScaleLabel}>{`Scale ${meta.scale}`}</div>
            </div>

            <div className={styles.drawingViewport}>
              <ModuleDrawingRenderer
                key={`${view}-${isCompactSheet ? 'compact' : 'wide'}`}
                view={view}
                status={status}
                planModel={planModel}
                sectionModel={sectionModel}
                detailMode="technical"
                presentation="sheet"
              />
            </div>

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

          <footer className={cx(styles.titleBlock, isCompactSheet && styles.titleBlockCompact)}>
            <div className={styles.companyBlock}>
              <div className={styles.companyName}>{PORTAL_COMPANY_PROFILE.name}</div>
              {PORTAL_COMPANY_PROFILE.addressLines.map((line) => (
                <div key={line} className={styles.companyLine}>
                  {line}
                </div>
              ))}
              <div className={styles.companyLine}>{PORTAL_COMPANY_PROFILE.phone}</div>
              <div className={styles.companyLine}>{PORTAL_COMPANY_PROFILE.email}</div>
            </div>

            <div className={styles.titleInfoBlock}>
              <div className={styles.titleInfoRow}>
                <span className={styles.blockLabel}>Drawing Title</span>
                <span className={styles.blockValue}>{meta.drawingTitle}</span>
              </div>
              <div className={styles.titleInfoRow}>
                <span className={styles.blockLabel}>Site Address</span>
                <span className={styles.blockValue}>{meta.siteAddress}</span>
              </div>
            </div>

            <div className={styles.noteBlock}>
              <div className={styles.blockLabel}>Note</div>
              <div className={styles.noteList}>
                {(noteLines.length ? noteLines : [meta.note]).map((line, index) => (
                  <div key={`${line}-${index}`} className={styles.noteLine}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Sheet</span>
                <span className={styles.metaValue}>{meta.sheetCode}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Revision</span>
                <span className={styles.metaValue}>{meta.revision}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Scale</span>
                <span className={styles.metaValue}>{meta.scale}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Date</span>
                <span className={styles.metaValue}>{meta.date}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Client</span>
                <span className={styles.metaValue}>{meta.client}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.blockLabel}>Issue</span>
                <span className={styles.metaValue}>{meta.issue}</span>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
