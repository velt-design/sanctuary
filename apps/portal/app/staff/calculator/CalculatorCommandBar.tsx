"use client";
import { useCalculatorSessionRead } from "./CalculatorSessionReadContext";
import styles from './CalculatorTrustUi.module.css';
import type { CalculatorReadinessSummary } from './calculatorReadinessSummary';
import CalculatorDraftStatus from './CalculatorDraftStatus';
import CalculatorDesignNavigationSelect from './CalculatorDesignNavigationSelect';
import type { CalculatorDesignNavigation } from './calculatorWorkspace';
import type { CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

type CalculatorCommandBarProps = {
  projectLabel: string;
  isEditingDesign: boolean;
  activeModuleLabel: string;
  readinessSummary: CalculatorReadinessSummary;
  localDraftStatus: CalculatorLocalDraftStatus;
  onSelectProject?: () => void;
  saveLabel: string;
  saveDisabled: boolean;
  onSave: () => void;
  saveError?: string;
  variant?: 'standalone' | 'embedded';
  designNavigation?: CalculatorDesignNavigation;
};

export default function CalculatorCommandBar({
  projectLabel,
  isEditingDesign,
  activeModuleLabel,
  readinessSummary,
  localDraftStatus,
  onSelectProject,
  saveLabel,
  saveDisabled,
  onSave,
  saveError,
  variant = 'standalone',
  designNavigation,
}: CalculatorCommandBarProps) {
  const {ready,error:readError}=useCalculatorSessionRead();
  const pendingLabel=readError?"Estimate unavailable":"Reading estimate…";
  const embedded = variant === 'embedded';
  const readinessClassName =
    !ready ? styles.commandBarStatusWaiting : readinessSummary.tone === 'ready'
      ? styles.commandBarStatusReady
      : readinessSummary.tone === 'review'
        ? styles.commandBarStatusReview
        : readinessSummary.tone === 'waiting'
          ? styles.commandBarStatusWaiting
          : styles.commandBarStatusBlocked;

  return (
    <header className={`${styles.commandBar}${embedded ? ` ${styles.commandBarEmbedded}` : ''}`} data-calculator-command-bar>
      <div className={styles.commandBarIdentity} data-calculator-command-identity>
        <div>
          {embedded && designNavigation ? (
            <CalculatorDesignNavigationSelect navigation={designNavigation} className={styles.commandBarDesignSelector} />
          ) : (
            <h1 className={styles.commandBarTitle}>Calculator</h1>
          )}
          <div className={styles.commandBarMeta}>
            {!embedded && onSelectProject ? (
              <button
                type="button"
                className={styles.commandBarProject}
                data-calculator-project-picker="enabled"
                onClick={onSelectProject}
                disabled={!ready}
              >
                {ready ? projectLabel : pendingLabel}
              </button>
            ) : !embedded ? (
              <span className={styles.commandBarProject} data-calculator-project-picker="fixed">{ready ? projectLabel : pendingLabel}</span>
            ) : null}
            {!embedded ? <span aria-hidden="true">·</span> : null}
            <span>{!ready ? pendingLabel : isEditingDesign ? 'Editing draft' : 'New design'}</span>
            <span aria-hidden="true">·</span>
            <span>{ready ? activeModuleLabel : ""}</span>
          </div>
          <CalculatorDraftStatus status={localDraftStatus} compact={embedded} />
        </div>
      </div>

      <div
        className={styles.commandBarControls}
        data-calculator-command-actions
        data-calculator-command-controls
      >
        <span
          className={readinessClassName}
          title={ready ? readinessSummary.accessibleLabel : pendingLabel}
          aria-label={ready ? readinessSummary.accessibleLabel : pendingLabel}
          data-calculator-command-readiness
        >
          {ready ? readinessSummary.label : pendingLabel}
        </span>

        <button
          type="button"
          className={styles.commandBarSave}
          onClick={onSave}
          disabled={!ready || saveDisabled}
          data-calculator-command-save
        >
          {saveLabel}
        </button>
      </div>
      {ready && saveError ? <p className={styles.commandBarError}>{saveError}</p> : null}
    </header>
  );
}
