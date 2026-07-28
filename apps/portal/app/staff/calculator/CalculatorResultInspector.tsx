'use client';

import {
  type ComponentProps,
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from 'react';

import CalculatorActualCostReview from './CalculatorActualCostReview';
import CalculatorItemPricingBreakdown from './CalculatorItemPricingBreakdown';
import CalculatorPreviewDetails, {
  type CalculatorPreviewDetailsProps,
} from './CalculatorPreviewDetails';
import CalculatorPricingDetails from './CalculatorPricingDetails';
import CalculatorPricingSummary, {
  type CalculatorPricingSummaryProps,
} from './CalculatorPricingSummary';
import CalculatorRafterExplanation from './CalculatorRafterExplanation';
import styles from './CalculatorResultInspector.module.css';
import type { CalculatorReadinessSummary } from './calculatorReadinessSummary';
import ModuleViewsCard from './ModuleViewsCard';
import PriceImpactPanel from './PriceImpactPanel';
import QuoteStatusCard from './QuoteStatusCard';

export type CalculatorResultInspectorTab =
  | 'pricing'
  | 'materials'
  | 'labour'
  | 'workings'
  | 'issues';

export type CalculatorResultInspectorHandle = {
  focusTab: (
    tab: CalculatorResultInspectorTab,
    options?: {
      /** Keep the focused tab visible inside the horizontal tab strip. Defaults to true. */
      reveal?: boolean;
    },
  ) => void;
};

export type CalculatorResultInspectorProps = {
  activeTab: CalculatorResultInspectorTab;
  onActiveTabChange: (tab: CalculatorResultInspectorTab) => void;
  pricingSummary: CalculatorPricingSummaryProps;
  pricingPreview: ComponentProps<typeof CalculatorItemPricingBreakdown>['preview'];
  actualCostEstimateId: string | null;
  moduleViews: ComponentProps<typeof ModuleViewsCard>;
  priceImpact: ComponentProps<typeof PriceImpactPanel> | null;
  quoteStatus: ComponentProps<typeof QuoteStatusCard>;
  previewDetails: Omit<CalculatorPreviewDetailsProps, 'view'>;
  rafterExplanation: ComponentProps<typeof CalculatorRafterExplanation>;
};

const TABS: Array<{ id: CalculatorResultInspectorTab; label: string }> = [
  { id: 'pricing', label: 'Pricing' },
  { id: 'materials', label: 'Materials' },
  { id: 'labour', label: 'Labour' },
  { id: 'workings', label: 'Workings' },
  { id: 'issues', label: 'Issues' },
];

function readinessClassName(tone: CalculatorReadinessSummary['tone']): string {
  if (tone === 'blocked') return styles.readinessBlocked;
  if (tone === 'review' || tone === 'waiting') return styles.readinessReview;
  return styles.readiness;
}

function revealTabHorizontally(tabList: HTMLDivElement, tab: HTMLButtonElement) {
  const tabListRect = tabList.getBoundingClientRect();
  const tabRect = tab.getBoundingClientRect();
  const hiddenBefore = tabRect.left - tabListRect.left;
  const hiddenAfter = tabRect.right - tabListRect.right;

  if (hiddenBefore < 0) {
    tabList.scrollLeft += hiddenBefore;
  } else if (hiddenAfter > 0) {
    tabList.scrollLeft += hiddenAfter;
  }
}

const CalculatorResultInspector = forwardRef<
  CalculatorResultInspectorHandle,
  CalculatorResultInspectorProps
>(function CalculatorResultInspector(
  {
    activeTab,
    onActiveTabChange,
    pricingSummary,
    pricingPreview,
    actualCostEstimateId,
    moduleViews,
    priceImpact,
    quoteStatus,
    previewDetails,
    rafterExplanation,
  },
  ref,
) {
  const tabSetId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<CalculatorResultInspectorTab, HTMLButtonElement>());
  const focusFrameRef = useRef<number | null>(null);
  const readiness = quoteStatus.readinessSummary;

  const focusTabButton = useCallback(
    (tab: CalculatorResultInspectorTab, reveal = true) => {
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
      }
      focusFrameRef.current = requestAnimationFrame(() => {
        focusFrameRef.current = null;
        const button = tabRefs.current.get(tab);
        if (!button) return;

        button.focus({ preventScroll: true });
        if (reveal && tabListRef.current) {
          revealTabHorizontally(tabListRef.current, button);
        }
      });
    },
    [],
  );

  useEffect(
    () => () => {
      if (focusFrameRef.current !== null) {
        cancelAnimationFrame(focusFrameRef.current);
      }
    },
    [],
  );

  const selectTab = useCallback(
    (tab: CalculatorResultInspectorTab, focus = false) => {
      if (tab !== activeTab) {
        onActiveTabChange(tab);
      }
      if (focus) {
        focusTabButton(tab);
      }
    },
    [activeTab, focusTabButton, onActiveTabChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      focusTab(tab, options) {
        if (tab !== activeTab) {
          onActiveTabChange(tab);
        }
        focusTabButton(tab, options?.reveal ?? true);
      },
    }),
    [activeTab, focusTabButton, onActiveTabChange],
  );

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: CalculatorResultInspectorTab,
  ) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    selectTab(TABS[nextIndex].id, true);
  };

  return (
    <section
      className={styles.inspector}
      aria-label="Calculator result inspector"
      data-calculator-result-inspector
      data-active-result-tab={activeTab}
    >
      <div className={styles.stickyHeader}>
        <div className={styles.heading}>
          <h2 className={styles.title}>Result inspector</h2>
          <div className={styles.trustState} aria-label="Result readiness">
            <span
              className={readinessClassName(readiness.tone)}
              title={readiness.accessibleLabel}
            >
              {readiness.label}
            </span>
            {pricingSummary.issuesCount > 0 ? (
              <button
                type="button"
                className={styles.issueButton}
                onClick={() => selectTab('issues')}
                aria-label={`Show Issues tab with ${pricingSummary.issuesCount} input issue${pricingSummary.issuesCount === 1 ? '' : 's'}`}
              >
                {pricingSummary.issuesCount} input issue{pricingSummary.issuesCount === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>
        </div>

        <CalculatorPricingSummary {...pricingSummary} variant="inspector" />

        <div
          ref={tabListRef}
          className={styles.tabs}
          role="tablist"
          aria-label="Result inspector sections"
        >
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            const tabId = `${tabSetId}-${tab.id}-tab`;
            const panelId = `${tabSetId}-${tab.id}-panel`;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.id, node);
                  else tabRefs.current.delete(tab.id);
                }}
                type="button"
                id={tabId}
                role="tab"
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                className={active ? styles.tabActive : styles.tab}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`${tabSetId}-pricing-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${tabSetId}-pricing-tab`}
        hidden={activeTab !== 'pricing'}
      >
        <CalculatorPricingDetails {...pricingSummary} />
        <CalculatorItemPricingBreakdown
          preview={pricingPreview}
          canViewInternalCosts={pricingSummary.canViewInternalCosts}
        />
        {actualCostEstimateId ? <CalculatorActualCostReview estimateId={actualCostEstimateId} /> : null}
        {priceImpact ? <PriceImpactPanel {...priceImpact} /> : null}
      </div>

      <div
        id={`${tabSetId}-materials-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${tabSetId}-materials-tab`}
        hidden={activeTab !== 'materials'}
      >
        <CalculatorPreviewDetails {...previewDetails} view="materials" />
      </div>

      <div
        id={`${tabSetId}-labour-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${tabSetId}-labour-tab`}
        hidden={activeTab !== 'labour'}
      >
        <CalculatorPreviewDetails {...previewDetails} view="labour" />
      </div>

      <div
        id={`${tabSetId}-workings-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${tabSetId}-workings-tab`}
        hidden={activeTab !== 'workings'}
      >
        <div className={styles.trustedWorking}>
          <CalculatorRafterExplanation {...rafterExplanation} />
          <ModuleViewsCard {...moduleViews} />
        </div>
        <CalculatorPreviewDetails {...previewDetails} view="workings" />
      </div>

      <div
        id={`${tabSetId}-issues-panel`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${tabSetId}-issues-tab`}
        hidden={activeTab !== 'issues'}
      >
        <QuoteStatusCard {...quoteStatus} />
        <CalculatorPreviewDetails {...previewDetails} view="issues" />
      </div>
    </section>
  );
});

export default CalculatorResultInspector;
