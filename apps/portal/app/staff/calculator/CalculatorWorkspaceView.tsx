'use client';

import {
  type ComponentProps,
  type ElementType,
  type FocusEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import styles from './CalculatorGrid.module.css';
import CalculatorCommandBar from './CalculatorCommandBar';
import CalculatorConfigurationForm from './CalculatorConfigurationForm';
import CalculatorInfillWorkspace, { type CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';
import CalculatorJobTemplatePicker from './CalculatorJobTemplatePicker';
import CalculatorModuleNavigator from './CalculatorModuleNavigator';
import CalculatorResultInspector, {
  type CalculatorResultInspectorHandle,
  type CalculatorResultInspectorProps,
  type CalculatorResultInspectorTab,
} from './CalculatorResultInspector';
import { type CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import CalculatorProjectPicker from './CalculatorProjectPicker';
import CalculatorSaveDialogs from './CalculatorSaveDialogs';
import CalculatorSaveOutcomeDialog from './CalculatorSaveOutcomeDialog';
import CalculatorStackedResultActions, {
  CalculatorStackedBackAction,
} from './CalculatorStackedResultActions';
import {
  findCalculatorVerticalScrollOwner,
  revealAndFocusCalculatorTarget,
  scheduleCalculatorLayoutTask,
} from './calculatorViewportNavigation';
import {
  CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX,
  useCalculatorPreviewSplit,
} from './useCalculatorPreviewSplit';

export type CalculatorWorkspaceViewProps = {
  embedded: boolean;
  commandBar: ComponentProps<typeof CalculatorCommandBar>;
  previewSplit: ReturnType<typeof useCalculatorPreviewSplit>;
  moduleNavigator: ComponentProps<typeof CalculatorModuleNavigator>;
  pricingSummary: CalculatorPricingSummaryProps;
  jobTemplatePicker: ComponentProps<typeof CalculatorJobTemplatePicker>;
  configurationForm: ComponentProps<typeof CalculatorConfigurationForm>;
  resultFreshness: ComponentProps<typeof CalculatorCommandBar>['resultFreshness'];
  pricingPreview: CalculatorResultInspectorProps['pricingPreview'];
  actualCostEstimateId: CalculatorResultInspectorProps['actualCostEstimateId'];
  moduleViews: CalculatorResultInspectorProps['moduleViews'];
  priceImpact: CalculatorResultInspectorProps['priceImpact'];
  quoteStatus: CalculatorResultInspectorProps['quoteStatus'];
  previewDetails: CalculatorResultInspectorProps['previewDetails'];
  rafterExplanation: CalculatorResultInspectorProps['rafterExplanation'];
  infillWorkspace: CalculatorInfillWorkspaceProps;
  saveDialogs: ComponentProps<typeof CalculatorSaveDialogs>;
  saveOutcome: ComponentProps<typeof CalculatorSaveOutcomeDialog>;
  projectPicker: ComponentProps<typeof CalculatorProjectPicker> | null;
};

const CONFIGURATION_CONTROL_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const CONFIGURATION_FIELD_SELECTOR = [
  '[data-calculator-configuration-form] input:not([disabled]):not([type="hidden"])',
  '[data-calculator-configuration-form] select:not([disabled])',
  '[data-calculator-configuration-form] textarea:not([disabled])',
  '[data-calculator-configuration-form] [data-calculator-field] button:not([disabled])',
  '[data-calculator-configuration-form] [data-calculator-field] [tabindex]:not([tabindex="-1"])',
].join(',');

function isRenderedWithin(target: HTMLElement, root: HTMLElement): boolean {
  let element: HTMLElement | null = target;
  while (element && root.contains(element)) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    element = element.parentElement;
  }
  return true;
}

function isIndependentVerticalScrollOwner(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return /^(auto|scroll|overlay)$/.test(style.overflowY || style.overflow);
}

function setScrollPosition(element: HTMLElement, top: number): void {
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top, behavior: 'auto' });
  } else {
    element.scrollTop = top;
  }
}

export default function CalculatorWorkspaceView({
  embedded,
  commandBar,
  previewSplit,
  moduleNavigator,
  pricingSummary,
  jobTemplatePicker,
  configurationForm,
  resultFreshness,
  pricingPreview,
  actualCostEstimateId,
  moduleViews,
  priceImpact,
  quoteStatus,
  previewDetails,
  rafterExplanation,
  infillWorkspace,
  saveDialogs,
  saveOutcome,
  projectPicker,
}: CalculatorWorkspaceViewProps) {
  const CalculatorRoot: ElementType = embedded ? 'section' : 'main';
  const [activeResultTab, setActiveResultTab] =
    useState<CalculatorResultInspectorTab>('pricing');
  const configurationMainRef = useRef<HTMLDivElement>(null);
  const lastConfigurationControlRef = useRef<HTMLElement | null>(null);
  const resultRailRef = useRef<HTMLElement>(null);
  const resultInspectorRef = useRef<CalculatorResultInspectorHandle>(null);
  const pendingOuterScrollRef = useRef<{ owner: HTMLElement; top: number } | null>(null);
  const cancelPendingNavigationRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const pendingScroll = pendingOuterScrollRef.current;
    if (!pendingScroll) return;
    pendingOuterScrollRef.current = null;
    setScrollPosition(pendingScroll.owner, pendingScroll.top);
  }, [activeResultTab]);

  useEffect(
    () => () => {
      cancelPendingNavigationRef.current?.();
    },
    [],
  );

  const handleConfigurationFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement
      && target.matches(CONFIGURATION_CONTROL_SELECTOR)
    ) {
      lastConfigurationControlRef.current = target;
    }
  }, []);

  const handleResultTabChange = useCallback(
    (nextTab: CalculatorResultInspectorTab) => {
      if (nextTab === activeResultTab) return;

      const resultRail = resultRailRef.current;
      if (resultRail) {
        if (isIndependentVerticalScrollOwner(resultRail)) {
          setScrollPosition(resultRail, 0);
        } else {
          const outerScrollOwner = findCalculatorVerticalScrollOwner(resultRail);
          pendingOuterScrollRef.current = {
            owner: outerScrollOwner,
            top: outerScrollOwner.scrollTop,
          };
        }
      }

      setActiveResultTab(nextTab);
    },
    [activeResultTab],
  );

  const scheduleResultNavigation = useCallback(
    (tab: CalculatorResultInspectorTab) => {
      handleResultTabChange(tab);
      cancelPendingNavigationRef.current?.();
      cancelPendingNavigationRef.current = scheduleCalculatorLayoutTask(() => {
        cancelPendingNavigationRef.current = null;
        const tabButton = resultRailRef.current?.querySelector<HTMLElement>(
          `[role="tab"][aria-controls$="-${tab}-panel"]`,
        );
        if (tabButton) {
          revealAndFocusCalculatorTarget(tabButton);
        }
        resultInspectorRef.current?.focusTab(tab);
      });
    },
    [handleResultTabChange],
  );

  const handleBackToConfiguration = useCallback(() => {
    cancelPendingNavigationRef.current?.();
    cancelPendingNavigationRef.current = scheduleCalculatorLayoutTask(() => {
      cancelPendingNavigationRef.current = null;
      const configurationMain = configurationMainRef.current;
      if (!configurationMain) return;

      const previousControl = lastConfigurationControlRef.current;
      const target =
        previousControl
        && previousControl.isConnected
        && configurationMain.contains(previousControl)
        && previousControl.matches(CONFIGURATION_CONTROL_SELECTOR)
        && isRenderedWithin(previousControl, configurationMain)
          ? previousControl
          : Array.from(
            configurationMain.querySelectorAll<HTMLElement>(CONFIGURATION_FIELD_SELECTOR),
          ).find((control) => isRenderedWithin(control, configurationMain));

      if (target) {
        revealAndFocusCalculatorTarget(target);
      }
    });
  }, []);

  return (
    <CalculatorRoot
      className={`${styles.page} ${styles.previewPage}${embedded ? ` ${styles.embeddedPage}` : ''}${previewSplit.isDragging ? ` ${styles.previewPageResizing}` : ''}`}
      data-calculator-workspace={embedded ? 'project' : 'standalone'}
      data-ui-foundation-consumer="calculator"
      data-ui-density="compact"
    >
      <div className={styles.previewFrame}>
        <CalculatorCommandBar {...commandBar} />
        <div
          className={styles.split}
          ref={previewSplit.splitRef}
          style={previewSplit.splitStyle}
          data-calculator-split="true"
        >
          <div className={styles.leftCol}>
            <div className={styles.configurationWorkspace} data-calculator-configuration-workspace>
              <CalculatorModuleNavigator {...moduleNavigator} />
              <CalculatorStackedResultActions
                pricingSummary={pricingSummary}
                onViewResults={() => scheduleResultNavigation('pricing')}
                onReviewIssues={() => scheduleResultNavigation('issues')}
              />
              <div
                ref={configurationMainRef}
                className={styles.configurationMain}
                data-calculator-configuration-main
                onFocusCapture={handleConfigurationFocus}
              >
                <CalculatorJobTemplatePicker {...jobTemplatePicker} />
                <CalculatorConfigurationForm {...configurationForm} isEmbedded={embedded} />
              </div>
            </div>
          </div>

          <button
            type="button"
            className={previewSplit.isDragging ? `${styles.columnResizeHandle} ${styles.columnResizeHandleActive}` : styles.columnResizeHandle}
            onPointerDown={previewSplit.onPointerDown}
            onPointerMove={previewSplit.onPointerMove}
            onPointerUp={previewSplit.onPointerUp}
            onPointerCancel={previewSplit.onPointerCancel}
            onLostPointerCapture={previewSplit.onLostPointerCapture}
            onKeyDown={previewSplit.onKeyDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel width"
            aria-valuemin={CALCULATOR_PREVIEW_SPLIT_RIGHT_MIN_PX}
            aria-valuemax={previewSplit.rightWidthMaxPx}
            aria-valuenow={previewSplit.rightWidthPx}
            title="Drag to resize preview panel"
          />

          <aside
            ref={resultRailRef}
            className={resultFreshness === 'current' ? styles.rightCol : `${styles.rightCol} ${styles.rightColStale}`}
            aria-label="Preview outputs"
            data-result-freshness={resultFreshness}
          >
            <CalculatorStackedBackAction onBackToConfiguration={handleBackToConfiguration} />
            <CalculatorResultInspector
              ref={resultInspectorRef}
              activeTab={activeResultTab}
              onActiveTabChange={handleResultTabChange}
              pricingSummary={pricingSummary}
              pricingPreview={pricingPreview}
              actualCostEstimateId={actualCostEstimateId}
              moduleViews={moduleViews}
              priceImpact={priceImpact}
              quoteStatus={quoteStatus}
              previewDetails={previewDetails}
              rafterExplanation={rafterExplanation}
            />
          </aside>
        </div>
      </div>

      <CalculatorInfillWorkspace {...infillWorkspace} />
      <CalculatorSaveDialogs {...saveDialogs} />
      <CalculatorSaveOutcomeDialog {...saveOutcome} />
      {projectPicker ? <CalculatorProjectPicker {...projectPicker} /> : null}
    </CalculatorRoot>
  );
}
