import type { InfillLineItem } from '@/lib/types/calculator';
import type { InfillUiState } from './infillCompute';
import {
  mapEngineLevel,
  mapInfillSeverity,
  type UiWarning,
} from './warnings';

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

export type CalculatorQuoteStatusActionKey = 'selectProject' | 'openProject' | 'openIssues' | 'openInfills';

type CalculatorQuoteStatusItem = {
  id: string;
  label: string;
  level: 'ok' | 'review' | 'block';
  detail?: string;
  actionLabel?: string;
  actionKey?: CalculatorQuoteStatusActionKey;
};

type CalculatorQuoteStatusUi = {
  items: CalculatorQuoteStatusItem[];
  hasStatusBlockers: boolean;
  anyInfillDraft: boolean;
};

type GenerateDesignPreflight =
  | { kind: 'error'; message: string }
  | { kind: 'save' }
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
  hasModuleErrors,
  engineError,
  hasResult,
  isCalculating,
  infillItems,
  infillUiById,
}: {
  projectId: string;
  hasProject: boolean;
  projectHasContact: boolean;
  hasModuleErrors: boolean;
  engineError: string | null | undefined;
  hasResult: boolean;
  isCalculating: boolean;
  infillItems: InfillLineItem[];
  infillUiById: ReadonlyMap<string, InfillUiWarningState | undefined>;
}): CalculatorQuoteStatusUi {
  const anyInfillDraft = infillItems.some((item) => infillUiById.get(item.id)?.status === 'draft');
  const items: CalculatorQuoteStatusItem[] = [
    {
      id: 'project',
      label: 'Project selected',
      level: projectId && hasProject ? 'ok' : 'block',
      detail: projectId ? (hasProject ? 'Attached' : 'Not found') : 'Select a project',
      actionLabel: !projectId ? 'Select' : undefined,
      actionKey: !projectId ? 'selectProject' : undefined,
    },
    {
      id: 'contact',
      label: 'Project contact',
      level: hasProject && projectHasContact ? 'ok' : hasProject ? 'block' : 'review',
      detail: hasProject ? (projectHasContact ? 'OK' : 'Missing contact on project') : '—',
      actionLabel: hasProject && !projectHasContact ? 'Open project' : undefined,
      actionKey: hasProject && !projectHasContact && projectId ? 'openProject' : undefined,
    },
    {
      id: 'inputs',
      label: 'Inputs valid',
      level: hasModuleErrors ? 'block' : 'ok',
      detail: hasModuleErrors ? 'Fix validation errors' : 'OK',
      actionLabel: hasModuleErrors ? 'View errors' : undefined,
      actionKey: hasModuleErrors ? 'openIssues' : undefined,
    },
    {
      id: 'engine',
      label: 'Engine ready',
      level: engineError || !hasResult || isCalculating ? 'block' : 'ok',
      detail: engineError ? engineError : isCalculating ? 'Calculating...' : hasResult ? 'Live' : 'Waiting',
    },
    {
      id: 'infills',
      label: 'Infills complete',
      level: anyInfillDraft ? 'block' : 'ok',
      detail: anyInfillDraft ? 'Finish required infill shape fields' : 'OK',
      actionLabel: anyInfillDraft ? 'Open infills' : undefined,
      actionKey: anyInfillDraft ? 'openInfills' : undefined,
    },
  ];

  return {
    items,
    hasStatusBlockers: items.some((item) => item.level === 'block'),
    anyInfillDraft,
  };
}

export function resolveGenerateDesignPreflight({
  projectId,
  hasProject,
  readyToCalculate,
  hasStatusBlockers,
  isCalculating,
  isEditingDesign,
  engineError,
  hasResult,
  warningCount,
}: {
  projectId: string;
  hasProject: boolean;
  readyToCalculate: boolean;
  hasStatusBlockers: boolean;
  isCalculating: boolean;
  isEditingDesign: boolean;
  engineError: string | null | undefined;
  hasResult: boolean;
  warningCount: number;
}): GenerateDesignPreflight {
  if (!projectId) return { kind: 'error', message: 'Select a project first (use Projects in the header).' };
  if (!hasProject) return { kind: 'error', message: 'Project not found.' };
  if (!readyToCalculate) return { kind: 'error', message: 'Fix validation errors before saving design.' };
  if (hasStatusBlockers) return { kind: 'error', message: 'Resolve blockers in Quote Status before saving design.' };
  if (isCalculating && !isEditingDesign) return { kind: 'error', message: 'Please wait for calculation to finish.' };
  if (engineError && !isEditingDesign) return { kind: 'error', message: 'Fix cost engine error before saving design.' };
  if (!hasResult && !isEditingDesign) return { kind: 'error', message: 'No calculated result yet.' };
  if (warningCount === 0 && !isEditingDesign) return { kind: 'save' };
  return { kind: 'confirm' };
}
