import type { InfillLineItem } from '@/lib/types/calculator';
import type { InfillUiState } from './infillCompute';
import {
  mapEngineLevel,
  mapInfillSeverity,
  type UiWarning,
} from './warnings';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';
import {
  buildCalculatorReadinessSummary,
  type CalculatorReadinessBlockedBy,
  type CalculatorReadinessSummary,
} from './calculatorReadinessSummary';

type EngineWarningInput = {
  level: string;
  message: string;
};

type InfillUiWarningState = Pick<InfillUiState, 'status' | 'warnings'>;

type CalculatorUiWarningGroups = {
  criticalUiWarnings: UiWarning[];
  reviewUiWarnings: UiWarning[];
  infoUiWarnings: UiWarning[];
  warningsCount: number;
  warningsHelperText: string | undefined;
};

export type CalculatorQuoteStatusActionKey = 'selectProject' | 'openProject' | 'openIssues' | 'openBlinds' | 'openInfills';

type CalculatorQuoteStatusItem = {
  id: string;
  label: string;
  level: 'ok' | 'review' | 'block';
  detail?: string;
  actionLabel?: string;
  actionKey?: CalculatorQuoteStatusActionKey;
  blockedBy?: CalculatorReadinessBlockedBy;
  causeCount?: number;
};

type CalculatorQuoteStatusUi = {
  items: CalculatorQuoteStatusItem[];
  hasStatusBlockers: boolean;
  blockerCount: number;
  anyInfillDraft: boolean;
  readinessSummary: CalculatorReadinessSummary;
};

type GenerateDesignPreflight =
  | { kind: 'error'; message: string }
  | { kind: 'confirm' };

export function buildCalculatorUiWarnings({
  engineWarnings,
  infillItems,
  infillUiById,
}: {
  engineWarnings: EngineWarningInput[] | null | undefined;
  infillItems: InfillLineItem[];
  infillUiById: ReadonlyMap<string, InfillUiWarningState | undefined>;
}): UiWarning[] {
  const engineUiWarnings: UiWarning[] = (engineWarnings ?? []).map((warning, index) => ({
    id: `engine-${index}`,
    severity: mapEngineLevel(warning.level),
    message: warning.message,
    source: 'engine',
  }));

  const infillUiWarnings: UiWarning[] = infillItems.flatMap((item, index) => {
    const ui = infillUiById.get(item.id);
    const label = item.label?.trim() || `Infill ${index + 1}`;
    const warnings = ui?.warnings ?? [];
    return warnings.map((warning) => ({
      id: `infill-${item.id}-${warning.id}`,
      severity: mapInfillSeverity(warning.severity),
      message: `${label}: ${warning.message}`,
      source: 'infill' as const,
      infillId: item.id,
      warning,
    }));
  });

  return [...engineUiWarnings, ...infillUiWarnings];
}

export function groupCalculatorUiWarnings(uiWarnings: UiWarning[]): CalculatorUiWarningGroups {
  const criticalUiWarnings = uiWarnings.filter((warning) => warning.severity === 'critical');
  const reviewUiWarnings = uiWarnings.filter((warning) => warning.severity === 'review');
  const infoUiWarnings = uiWarnings.filter((warning) => warning.severity === 'info');
  const warningsCount = uiWarnings.length;
  return {
    criticalUiWarnings,
    reviewUiWarnings,
    infoUiWarnings,
    warningsCount,
    warningsHelperText:
      warningsCount && criticalUiWarnings.length
        ? `Critical: ${criticalUiWarnings.length} (blocks design save)`
        : warningsCount && reviewUiWarnings.length
          ? `Review: ${reviewUiWarnings.length} (ack required)`
          : warningsCount
            ? `Info: ${infoUiWarnings.length}`
            : undefined,
  };
}

export function buildCalculatorQuoteStatusUi({
  projectId,
  hasProject,
  projectHasContact,
  inputIssueCount,
  invalidBlindCount,
  engineError,
  resultFreshness,
  infillItems,
  infillUiById,
}: {
  projectId: string;
  hasProject: boolean;
  projectHasContact: boolean;
  inputIssueCount: number;
  invalidBlindCount: number;
  engineError: string | null | undefined;
  resultFreshness: CalculatorResultFreshness;
  infillItems: InfillLineItem[];
  infillUiById: ReadonlyMap<string, InfillUiWarningState | undefined>;
}): CalculatorQuoteStatusUi {
  const normalizedInputIssueCount = Math.max(0, Math.round(inputIssueCount));
  const draftInfillCount = infillItems.filter(
    (item) => infillUiById.get(item.id)?.status === 'draft',
  ).length;
  const anyInfillDraft = draftInfillCount > 0;
  const engineBlockedByInputs =
    normalizedInputIssueCount > 0
    && (resultFreshness === 'invalid' || resultFreshness === 'waiting');
  const engineCauseCount =
    resultFreshness === 'current'
      ? undefined
      : engineBlockedByInputs
        ? 0
        : resultFreshness === 'error' || resultFreshness === 'invalid'
          ? 1
          : 0;
  const items: CalculatorQuoteStatusItem[] = [
    {
      id: 'project',
      label: 'Project selected',
      level: projectId && hasProject ? 'ok' : 'block',
      detail: projectId ? (hasProject ? 'Attached' : 'Not found') : 'Select a project',
      actionLabel: !projectId ? 'Select' : undefined,
      actionKey: !projectId ? 'selectProject' : undefined,
      causeCount: projectId && hasProject ? undefined : 1,
    },
    {
      id: 'contact',
      label: 'Project contact',
      level: hasProject && projectHasContact ? 'ok' : hasProject ? 'block' : 'review',
      detail: hasProject ? (projectHasContact ? 'OK' : 'Missing contact on project') : '—',
      actionLabel: hasProject && !projectHasContact ? 'Open project' : undefined,
      actionKey: hasProject && !projectHasContact && projectId ? 'openProject' : undefined,
      causeCount: hasProject && !projectHasContact ? 1 : undefined,
    },
    {
      id: 'inputs',
      label: 'Inputs valid',
      level: normalizedInputIssueCount > 0 ? 'block' : 'ok',
      detail: normalizedInputIssueCount > 0
        ? `${normalizedInputIssueCount} input issue${normalizedInputIssueCount === 1 ? '' : 's'} to fix`
        : 'OK',
      actionLabel: normalizedInputIssueCount > 0 ? 'View errors' : undefined,
      actionKey: normalizedInputIssueCount > 0 ? 'openIssues' : undefined,
      causeCount: normalizedInputIssueCount || undefined,
    },
    {
      id: 'blinds',
      label: 'Blinds priced',
      level: invalidBlindCount > 0 ? 'block' : 'ok',
      detail: invalidBlindCount > 0
        ? `${invalidBlindCount} blind${invalidBlindCount === 1 ? ' needs' : 's need'} valid dimensions and selections`
        : 'OK',
      actionLabel: invalidBlindCount > 0 ? 'Review blinds' : undefined,
      actionKey: invalidBlindCount > 0 ? 'openBlinds' : undefined,
      causeCount: invalidBlindCount > 0 ? invalidBlindCount : undefined,
    },
    {
      id: 'engine',
      label: 'Engine ready',
      level: resultFreshness === 'current' ? 'ok' : 'block',
      detail:
        resultFreshness === 'current'
          ? 'Live'
          : resultFreshness === 'calculating'
            ? 'Updating...'
            : resultFreshness === 'invalid'
              ? 'Fix inputs to refresh result'
              : resultFreshness === 'stale'
                ? 'Recalculation pending'
                : resultFreshness === 'error'
                  ? engineError ?? 'Update failed'
                  : 'Waiting for valid inputs',
      blockedBy: engineBlockedByInputs ? 'inputs' : undefined,
      causeCount: engineCauseCount,
    },
    {
      id: 'infills',
      label: 'Infills complete',
      level: anyInfillDraft ? 'block' : 'ok',
      detail: anyInfillDraft ? 'Finish required infill shape fields' : 'OK',
      actionLabel: anyInfillDraft ? 'Open infills' : undefined,
      actionKey: anyInfillDraft ? 'openInfills' : undefined,
      causeCount: draftInfillCount || undefined,
    },
  ];

  const blockerCount = items.filter((item) => item.level === 'block').length;
  const readinessSummary = buildCalculatorReadinessSummary({ items, resultFreshness });
  return {
    items,
    hasStatusBlockers: blockerCount > 0,
    blockerCount,
    anyInfillDraft,
    readinessSummary,
  };
}

export function resolveGenerateDesignPreflight({
  projectId,
  hasProject,
  readyToCalculate,
  hasStatusBlockers,
  resultFreshness,
}: {
  projectId: string;
  hasProject: boolean;
  readyToCalculate: boolean;
  hasStatusBlockers: boolean;
  resultFreshness: CalculatorResultFreshness;
}): GenerateDesignPreflight {
  if (!projectId) return { kind: 'error', message: 'Select a project before saving design.' };
  if (!hasProject) return { kind: 'error', message: 'Project not found.' };
  if (!readyToCalculate) return { kind: 'error', message: 'Fix validation errors before saving design.' };
  if (resultFreshness === 'calculating') return { kind: 'error', message: 'Please wait for calculation to finish.' };
  if (resultFreshness === 'error') return { kind: 'error', message: 'Fix cost engine error before saving design.' };
  if (resultFreshness !== 'current') return { kind: 'error', message: 'Wait for a current calculated result before saving design.' };
  if (hasStatusBlockers) return { kind: 'error', message: 'Resolve blockers in Quote Status before saving design.' };
  return { kind: 'confirm' };
}
