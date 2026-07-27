import type { ComponentProps, ElementType } from 'react';

import styles from './CalculatorGrid.module.css';
import CalculatorCommandBar from './CalculatorCommandBar';
import CalculatorConfigurationForm from './CalculatorConfigurationForm';
import CalculatorInfillWorkspace, { type CalculatorInfillWorkspaceProps } from './CalculatorInfillWorkspace';
import CalculatorJobTemplatePicker from './CalculatorJobTemplatePicker';
import CalculatorModuleNavigator from './CalculatorModuleNavigator';
import CalculatorResultInspector, {
  type CalculatorResultInspectorProps,
} from './CalculatorResultInspector';
import CalculatorPricingSummary, { type CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
import CalculatorProjectPicker from './CalculatorProjectPicker';
import CalculatorSaveDialogs from './CalculatorSaveDialogs';
import CalculatorSaveOutcomeDialog from './CalculatorSaveOutcomeDialog';
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
            <CalculatorResultInspector
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
