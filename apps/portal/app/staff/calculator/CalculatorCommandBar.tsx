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
  const embedded = variant === 'embedded';
  const readinessClassName =
    readinessSummary.tone === 'ready'
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
              >
                {projectLabel}
              </button>
            ) : !embedded ? (
              <span className={styles.commandBarProject} data-calculator-project-picker="fixed">{projectLabel}</span>
            ) : null}
            {!embedded ? <span aria-hidden="true">·</span> : null}
            <span>{isEditingDesign ? 'Editing draft' : 'New design'}</span>
            <span aria-hidden="true">·</span>
            <span>{activeModuleLabel}</span>
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
          title={readinessSummary.accessibleLabel}
          aria-label={readinessSummary.accessibleLabel}
          data-calculator-command-readiness
        >
          {readinessSummary.label}
        </span>

        <button
          type="button"
          className={styles.commandBarSave}
          onClick={onSave}
          disabled={saveDisabled}
          data-calculator-command-save
        >
          {saveLabel}
        </button>
      </div>
      {saveError ? <p className={styles.commandBarError}>{saveError}</p> : null}
    </header>
  );
}
