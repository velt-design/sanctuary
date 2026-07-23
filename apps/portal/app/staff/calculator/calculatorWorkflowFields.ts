import type { ReactNode } from 'react';

import { MAX_STAFF_QUOTE_DISCOUNT_PCT } from '@/lib/quotes/pricing';
import type { CalculatorInputs } from '@/lib/types/calculator';
import type { Project } from '@/lib/types/project';
import type { CalculatorConfigurationField as FieldSchemaItem } from './calculatorConfigurationSections';
import {
  calculatorResultFreshnessLabel,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';

type CalculatorJobFieldSetter = <K extends Exclude<keyof CalculatorInputs, 'modules'>>(
  key: K,
  next: CalculatorInputs[K],
) => void;

export type CalculatorContextFieldBuilderInput = {
  resultFreshness: CalculatorResultFreshness;
  engineError: string | null | undefined;
  project: Project | null;
  projectId: string | null;
  projectError: string | null | undefined;
  draftNotice: string | null | undefined;
  values: CalculatorInputs;
  setJobField: CalculatorJobFieldSetter;
};

export function buildCalculatorContextFields({
  resultFreshness,
  engineError,
  project,
  projectId,
  projectError,
  draftNotice,
  values,
  setJobField,
}: CalculatorContextFieldBuilderInput): FieldSchemaItem[] {
  return [
    {
      id: 'engine-status',
      label: 'Cost engine',
      type: 'readOnly',
      value: calculatorResultFreshnessLabel(resultFreshness),
      error: engineError ?? undefined,
      helperText: engineError ? undefined : 'True cost (ex‑GST)',
    },
    {
      id: 'project-context',
      label: 'Project',
      type: 'readOnly',
      value: project ? project.projectName ?? project.name ?? '—' : projectId ? 'Not found' : 'None',
      helperText: project ? undefined : 'Use Projects in the header to select or create one.',
      error: projectId && !project ? projectError ?? undefined : undefined,
    },

    ...(draftNotice
      ? [
          {
            id: 'draft-notice',
            label: 'Draft',
            type: 'readOnly',
            value: 'Active',
            helperText: draftNotice,
          } satisfies FieldSchemaItem,
        ]
      : []),

    ...(projectId && project
      ? [
          {
            id: 'projectName',
            label: 'Project name',
            type: 'readOnly',
            value: project.projectName ?? project.name ?? '—',
          } satisfies FieldSchemaItem,
          { id: 'quoteRef', label: 'Quote ref', type: 'readOnly', value: project.quoteRef ?? '—', helperText: 'Internal reference' } satisfies FieldSchemaItem,
        ]
      : [
          {
            id: 'projectName',
            label: 'Project name',
            type: 'text',
            value: values.projectName,
            onChange: (v) => setJobField('projectName', String(v)),
          } satisfies FieldSchemaItem,
          {
            id: 'quoteRef',
            label: 'Quote ref',
            type: 'text',
            value: values.quoteRef,
            onChange: (v) => setJobField('quoteRef', String(v)),
            helperText: 'Internal reference',
          } satisfies FieldSchemaItem,
        ]),
  ];
}
export type CalculatorWorkflowFieldBuilderInput = {
  blindsListContent: ReactNode;
  blindsUi: {
    summaryText: string;
    totalEx: number;
    totalInc: number;
  };
  infillsTileContent: ReactNode;
  infillsSummaryText: string;
  values: CalculatorInputs;
  setJobField: CalculatorJobFieldSetter;
  derivedArea: number | undefined;
  derivedRoofArea: number | undefined;
  derivedAcrylicArea: number | undefined;
  derivedTimberArea: number | undefined;
  derivedAcrylicBaysTotal: number | undefined;
  derivedPitchUsed: number | undefined;
  derivedSlopeLength: number | undefined;
  moduleResult: unknown;
  roofingProcurementSummary: string;
  rafterCountTotal: number | null;
  rafterProfile: string | null | undefined;
  rafterHelperText: string | undefined;
  bracketCount: number | undefined;
  crewHours: number | undefined;
  materialsEx: number | undefined;
  installEx: number | undefined;
  overheadEx: number | undefined;
  totalEx: number | undefined;
  totalInc: number | undefined;
  issuesCount: number;
  onOpenIssues: () => void;
  result: unknown;
  warningsCount: number;
  warningsHelperText: string | undefined;
  generateLabel: string;
  onGenerate: () => void;
  projectId: string | null;
  generateError: string | null | undefined;
  isGenerating: boolean;
  hasStatusBlockers: boolean;
  resultFreshness: CalculatorResultFreshness;
};

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatMaybeMoney(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return formatMoney(value);
}

function formatMaybeNumber(value: number | undefined, digits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function buildCalculatorWorkflowFields({
  blindsListContent,
  blindsUi,
  infillsTileContent,
  infillsSummaryText,
  values,
  setJobField,
  derivedArea,
  derivedRoofArea,
  derivedAcrylicArea,
  derivedTimberArea,
  derivedAcrylicBaysTotal,
  derivedPitchUsed,
  derivedSlopeLength,
  moduleResult,
  roofingProcurementSummary,
  rafterCountTotal,
  rafterProfile,
  rafterHelperText,
  bracketCount,
  crewHours,
  materialsEx,
  installEx,
  overheadEx,
  totalEx,
  totalInc,
  issuesCount,
  onOpenIssues,
  result,
  warningsCount,
  warningsHelperText,
  generateLabel,
  onGenerate,
  projectId,
  generateError,
  isGenerating,
  hasStatusBlockers,
  resultFreshness,
}: CalculatorWorkflowFieldBuilderInput): FieldSchemaItem[] {
  return [
    {
      id: 'blindsList',
      label: 'Blinds',
      type: 'custom',
      content: blindsListContent,
      helperText: blindsUi.summaryText,
    },
    {
      id: 'infillsEditor',
      label: 'Infills',
      type: 'custom',
      content: infillsTileContent,
      helperText: infillsSummaryText,
    },
    {
      id: 'travelExGst',
      label: 'Travel (ex‑GST)',
      type: 'number',
      value: values.travelExGst,
      onChange: (v) => setJobField('travelExGst', String(v)),
    },
    {
      id: 'extrasAllowanceExGst',
      label: 'Extras allowance (ex‑GST)',
      type: 'number',
      value: values.extrasAllowanceExGst,
      onChange: (v) => setJobField('extrasAllowanceExGst', String(v)),
    },
    {
      id: 'quoteDiscountPct',
      label: `Discount (0–${MAX_STAFF_QUOTE_DISCOUNT_PCT}%)`,
      type: 'number',
      value: values.quoteDiscountPct,
      min: 0,
      max: 80,
      onChange: (v) => {
        const raw = String(v);
        if (!raw.trim()) {
          setJobField('quoteDiscountPct', '');
          return;
        }
        const parsed = Number.parseFloat(raw);
        if (!Number.isFinite(parsed)) return;
        setJobField(
          'quoteDiscountPct',
          String(Math.min(MAX_STAFF_QUOTE_DISCOUNT_PCT, Math.max(0, parsed))),
        );
      },
      helperText: '0–80%. Applies to pergola and shared site selling prices; blinds and lighting stay at listed price.',
    },

    // === Computed outputs ===
    { id: 'areaM2', label: 'Area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedArea) },
    { id: 'roofAreaM2', label: 'Roof area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedRoofArea) },
    { id: 'acrylicAreaM2', label: 'Acrylic area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedAcrylicArea) },
    { id: 'timberAreaM2', label: 'Timber area (m²)', type: 'readOnly', value: formatMaybeNumber(derivedTimberArea) },
    { id: 'acrylicBaysTotal', label: 'Acrylic bays total', type: 'readOnly', value: typeof derivedAcrylicBaysTotal === 'number' ? String(derivedAcrylicBaysTotal) : '—' },
    { id: 'pitchUsed', label: 'Pitch used (deg)', type: 'readOnly', value: typeof derivedPitchUsed === 'number' ? derivedPitchUsed.toFixed(0) : '—' },
    { id: 'slopeLengthM', label: 'Slope length (m)', type: 'readOnly', value: formatMaybeNumber(derivedSlopeLength) },
    { id: 'roofingProcurement', label: 'Roofing', type: 'readOnly', value: moduleResult ? roofingProcurementSummary : '—' },
    {
      id: 'rafters',
      label: 'Rafters',
      type: 'readOnly',
      value: rafterCountTotal && rafterProfile ? `${rafterCountTotal} × ${rafterProfile}` : '—',
      helperText: rafterHelperText,
    },
    { id: 'brackets', label: 'Brackets', type: 'readOnly', value: typeof bracketCount === 'number' ? String(bracketCount) : '—' },
    { id: 'crewHours', label: 'Crew hours', type: 'readOnly', value: typeof crewHours === 'number' ? String(crewHours) : '—' },
    { id: 'materialsEx', label: 'Materials (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(materialsEx) },
    { id: 'installEx', label: 'Install payout (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(installEx) },
    { id: 'overheadEx', label: 'Overhead (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(overheadEx) },
    { id: 'totalEx', label: 'Internal true cost (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(totalEx) },
    { id: 'totalInc', label: 'Internal true cost (inc‑GST)', type: 'readOnly', value: formatMaybeMoney(totalInc) },
    { id: 'blindsTotalEx', label: 'Blind customer price (ex‑GST)', type: 'readOnly', value: formatMaybeMoney(blindsUi.totalEx) },
    { id: 'blindsTotalInc', label: 'Blind customer price (inc‑GST)', type: 'readOnly', value: formatMaybeMoney(blindsUi.totalInc) },
    ...(issuesCount
      ? [
          {
            id: 'issues',
            label: 'Issues',
            type: 'action',
            actionLabel: `Errors (${issuesCount})`,
            onAction: onOpenIssues,
            helperText: 'Click to jump to missing fields',
          } satisfies FieldSchemaItem,
        ]
      : []),
    {
      id: 'warnings',
      label: 'Warnings',
      type: 'readOnly',
      value: result ? String(warningsCount) : '—',
      helperText: warningsHelperText,
    },
    {
      id: 'generate-estimate',
      label: 'Design',
      type: 'action',
      actionLabel: generateLabel,
      onAction: onGenerate,
      helperText: projectId ? 'Save current design draft' : 'Requires project context',
      error: generateError ?? undefined,
      disabled: isGenerating || hasStatusBlockers || resultFreshness !== 'current',
    },
  ];
}
