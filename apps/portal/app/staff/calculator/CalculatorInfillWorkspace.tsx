'use client';

import type { ComponentProps } from 'react';

import DuplicateDialog from './DuplicateDialog';
import InfillConfiguratorDialog from './InfillConfiguratorDialog';
import InfillEditorHeader from './InfillEditorHeader';
import InfillOpeningStage from './InfillOpeningStage';
import InfillResultsStage from './InfillResultsStage';
import InfillSupportsStage from './InfillSupportsStage';
import { CalculatorInfillRail, InfillPresetMenu } from './CalculatorInfillOverview';
import styles from './CalculatorGrid.module.css';
import type { InfillPresetKey } from './calculatorInputs';
import CalculatorInfillCostComparison from './CalculatorInfillCostComparison';
import type { CalculatorInfillCostComparison as InfillCostComparisonModel } from './useCalculatorInfillCostComparison';

type HeaderProps = ComponentProps<typeof InfillEditorHeader>;
type RailProps = ComponentProps<typeof CalculatorInfillRail>;
type OpeningStageProps = ComponentProps<typeof InfillOpeningStage>;
type SupportsStageProps = ComponentProps<typeof InfillSupportsStage>;
type ResultsStageProps = Omit<ComponentProps<typeof InfillResultsStage>, 'technicalDetails'>;
type DuplicateProps = ComponentProps<typeof DuplicateDialog>;
type DialogProps = Pick<
  ComponentProps<typeof InfillConfiguratorDialog>,
  'closeOnEsc' | 'onClose' | 'stage' | 'openingComplete' | 'blockerCount' | 'onStageChange'
>;
type Presets = ComponentProps<typeof InfillPresetMenu>['presets'];

export type CalculatorInfillWorkspaceProps = {
  open: boolean;
  dialog: DialogProps;
  header: HeaderProps | null;
  showUndo: boolean;
  onUndo: () => void;
  rail: RailProps;
  openingStage: OpeningStageProps | null;
  supportsStage: SupportsStageProps | null;
  resultsStage: ResultsStageProps | null;
  costComparison: {
    model: InfillCostComparisonModel;
    onApply: (source: 'sheet_panels' | 'strip_620') => void;
  } | null;
  itemCount: number;
  presets: Presets;
  onAddPreset: (preset: InfillPresetKey) => void;
  onAddPresetFromOverview: (preset: InfillPresetKey, openModal?: boolean) => void;
  duplicate: DuplicateProps;
};

export default function CalculatorInfillWorkspace({
  open,
  dialog,
  header,
  showUndo,
  onUndo,
  rail,
  openingStage,
  supportsStage,
  resultsStage,
  costComparison,
  itemCount,
  presets,
  onAddPreset,
  onAddPresetFromOverview,
  duplicate,
}: CalculatorInfillWorkspaceProps) {
  if (!open) return null;

  return (
    <>
      <InfillConfiguratorDialog
        {...dialog}
        editorHeader={header ? <InfillEditorHeader {...header} /> : null}
        notice={showUndo ? (
          <div className={styles.infillUndoToast} role="status" aria-live="polite">
            <span>Infill deleted.</span>
            <button type="button" className={styles.infillUndoButton} onClick={onUndo}>Undo</button>
          </div>
        ) : null}
        rail={<CalculatorInfillRail {...rail} />}
      >
        {dialog.stage === 'opening' && openingStage ? <InfillOpeningStage {...openingStage} /> : null}
        {dialog.stage === 'supports' && supportsStage ? <InfillSupportsStage {...supportsStage} /> : null}
        {dialog.stage === 'results' && resultsStage ? (
          <InfillResultsStage
            {...resultsStage}
            technicalDetails={costComparison ? (
              <CalculatorInfillCostComparison
                comparison={costComparison.model}
                onApply={costComparison.onApply}
              />
            ) : undefined}
          />
        ) : null}

        {!openingStage && !supportsStage && !resultsStage && itemCount === 0 ? (
          <div className={styles.infillEditorEmpty}>
            <strong className={styles.infillEditorEmptyTitle}>
              {rail.standalone ? 'Add an infill to the existing pergola' : 'Choose how you want to start'}
            </strong>
            <p>
              {rail.standalone
                ? 'Enter the finished opening and confirm the existing members it will fix to.'
                : 'Use a preset for the fastest setup, or create a custom infill if this layout is unique.'}
            </p>
            {presets.length ? (
              <>
                <div className={styles.infillEditorEmptySectionTitle}>Use a preset</div>
                <div className={styles.infillPresetCardGrid}>
                  {presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={styles.infillPresetCard}
                      onClick={() => onAddPreset(preset.key)}
                    >
                      <strong>{preset.label}</strong>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <button type="button" className={styles.infillPrimaryButton} onClick={() => onAddPreset('custom')}>
              Add custom infill
            </button>
            <p className={styles.infillEditorEmptyNote}>
              {presets.length
                ? 'Presets are the quickest way to begin. You can edit panel layout, supports, and dimensions afterwards.'
                : 'Enter the finished opening, existing supports and required panel layout.'}
            </p>
          </div>
        ) : !openingStage && !supportsStage && !resultsStage ? (
          <div className={styles.infillEditorEmpty}>
            <strong className={styles.infillEditorEmptyTitle}>Select an infill to edit it</strong>
            <p>Pick one from the list, or add a new infill{rail.standalone ? ' to the existing pergola' : ' to this module'}.</p>
            <div className={styles.infillEditorActions}>
              {presets.length ? (
                <InfillPresetMenu
                  label="Presets"
                  presets={presets}
                  onAddPreset={onAddPresetFromOverview}
                />
              ) : null}
              <button type="button" className={styles.infillSecondaryButton} onClick={() => onAddPreset('custom')}>
                Add custom infill
              </button>
            </div>
          </div>
        ) : null}
      </InfillConfiguratorDialog>
      <DuplicateDialog {...duplicate} />
    </>
  );
}
