import styles from './CalculatorTrustUi.module.css';
import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';
import CalculatorDraftStatus from './CalculatorDraftStatus';
import CalculatorDesignNavigationSelect from './CalculatorDesignNavigationSelect';
import type { CalculatorDesignNavigation } from './calculatorWorkspace';
import type { CalculatorLocalDraftStatus } from './useCalculatorDraftSession';

export type CalculatorUiMode = 'basic' | 'advanced';

type CalculatorCommandBarProps = {
  projectLabel: string;
  isEditingDesign: boolean;
  activeModuleLabel: string;
  uiMode: CalculatorUiMode;
  onUiModeChange: (mode: CalculatorUiMode) => void;
  resultFreshness: CalculatorResultFreshness;
  localDraftStatus: CalculatorLocalDraftStatus;
  blockerCount: number;
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
  uiMode,
  onUiModeChange,
  resultFreshness,
  localDraftStatus,
  blockerCount,
  onSelectProject,
  saveLabel,
  saveDisabled,
  onSave,
  saveError,
  variant = 'standalone',
  designNavigation,
}: CalculatorCommandBarProps) {
  const freshnessLabel = calculatorResultFreshnessLabel(resultFreshness);
  const embedded = variant === 'embedded';

  return (
    <header className={`${styles.commandBar}${embedded ? ` ${styles.commandBarEmbedded}` : ''}`} data-calculator-command-bar>
      <div className={styles.commandBarIdentity}>
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

      <div className={styles.commandBarActions} data-calculator-command-actions>
        <span
          className={
            blockerCount > 0 || resultFreshness !== 'current'
              ? styles.commandBarStatusBlocked
              : styles.commandBarStatusReady
          }
          title={freshnessLabel}
          aria-label={`${freshnessLabel}. ${blockerCount ? `${blockerCount} blockers` : 'Ready to save'}`}
        >
          {blockerCount ? `${blockerCount} blocker${blockerCount === 1 ? '' : 's'}` : freshnessLabel}
        </span>

        <div className={styles.commandBarMode} aria-label="Calculator detail level">
          {(['basic', 'advanced'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={uiMode === mode ? styles.commandBarModeActive : styles.commandBarModeButton}
              onClick={() => onUiModeChange(mode)}
              aria-pressed={uiMode === mode}
            >
              {mode === 'basic' ? 'Basic' : 'Advanced'}
            </button>
          ))}
        </div>

      </div>

      <button type="button" className={styles.commandBarSave} onClick={onSave} disabled={saveDisabled}>
        {saveLabel}
      </button>
      {saveError ? <p className={styles.commandBarError}>{saveError}</p> : null}
    </header>
  );
}
