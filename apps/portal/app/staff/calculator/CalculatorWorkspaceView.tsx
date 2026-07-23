import type { ComponentProps, ElementType } from 'react';

import styles from './CalculatorGrid.module.css';
import CalculatorActualCostReview from './CalculatorActualCostReview';
import CalculatorCommandBar from './CalculatorCommandBar';
import CalculatorConfigurationForm from './CalculatorConfigurationForm';
import CalculatorInfillWorkspace, { type CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';
import CalculatorItemPricingBreakdown from './CalculatorItemPricingBreakdown';
import CalculatorJobTemplatePicker from './CalculatorJobTemplatePicker';
import CalculatorModuleNavigator from './CalculatorModuleNavigator';
import CalculatorPreviewDetails from './CalculatorPreviewDetails';
import CalculatorPricingSummary, { type CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import CalculatorProjectPicker from './CalculatorProjectPicker';
import CalculatorSaveDialogs from './CalculatorSaveDialogs';
import CalculatorSaveOutcomeDialog from './CalculatorSaveOutcomeDialog';
import ModuleViewsCard from './ModuleViewsCard';
import PriceImpactPanel from './PriceImpactPanel';
import QuoteStatusCard from './QuoteStatusCard';
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
  pricingPreview: ComponentProps<typeof CalculatorItemPricingBreakdown>['preview'];
  actualCostEstimateId: string | null;
  moduleViews: ComponentProps<typeof ModuleViewsCard>;
  priceImpact: ComponentProps<typeof PriceImpactPanel> | null;
  quoteStatus: ComponentProps<typeof QuoteStatusCard>;
  previewDetails: ComponentProps<typeof CalculatorPreviewDetails>;
  infillWorkspace: CalculatorInfillWorkspaceProps;
  saveDialogs: ComponentProps<typeof CalculatorSaveDialogs>;
  saveOutcome: ComponentProps<typeof CalculatorSaveOutcomeDialog>;
  projectPicker: ComponentProps<typeof CalculatorProjectPicker> | null;
};

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
  infillWorkspace,
  saveDialogs,
  saveOutcome,
  projectPicker,
}: CalculatorWorkspaceViewProps) {
  const CalculatorRoot: ElementType = embedded ? 'section' : 'main';

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
              <CalculatorPricingSummary {...pricingSummary} variant="compact" />
              <div className={styles.configurationMain} data-calculator-configuration-main>
                <CalculatorJobTemplatePicker {...jobTemplatePicker} />
                <CalculatorConfigurationForm {...configurationForm} />
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
            className={resultFreshness === 'current' ? styles.rightCol : `${styles.rightCol} ${styles.rightColStale}`}
            aria-label="Preview outputs"
            data-result-freshness={resultFreshness}
          >
            <div className={styles.previewSummary}>
              <CalculatorPricingSummary {...pricingSummary} />
              <CalculatorItemPricingBreakdown preview={pricingPreview} />
              {actualCostEstimateId ? <CalculatorActualCostReview estimateId={actualCostEstimateId} /> : null}
              <ModuleViewsCard {...moduleViews} />

              {priceImpact ? <PriceImpactPanel {...priceImpact} /> : null}

              <QuoteStatusCard {...quoteStatus} />
            </div>

            <CalculatorPreviewDetails {...previewDetails} />
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
