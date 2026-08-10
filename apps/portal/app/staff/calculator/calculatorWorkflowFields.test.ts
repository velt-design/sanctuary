import { describe, expect, it, vi } from 'vitest';

import type { Project } from '@/lib/types/project';
import type { CalculatorConfigurationField } from './calculatorConfigurationSections';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import {
  buildCalculatorContextFields,
  buildCalculatorWorkflowFields,
  type CalculatorContextFieldBuilderInput,
  type CalculatorWorkflowFieldBuilderInput,
} from './calculatorWorkflowFields';

function fieldById(fields: readonly CalculatorConfigurationField[], id: string): CalculatorConfigurationField {
  const field = fields.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Missing calculator workflow field: ${id}`);
  return field;
}

function contextFields(overrides: Partial<CalculatorContextFieldBuilderInput> = {}) {
  const setJobField = vi.fn() as unknown as CalculatorContextFieldBuilderInput['setJobField'];
  const fields = buildCalculatorContextFields({
    resultFreshness: 'current',
    engineError: null,
    project: null,
    projectId: null,
    projectError: null,
    draftNotice: null,
    values: makeDefaultCalculatorInputs(),
    setJobField,
    ...overrides,
  });
  return { fields, setJobField };
}

function workflowFields(overrides: Partial<CalculatorWorkflowFieldBuilderInput> = {}) {
  const setJobField = vi.fn() as unknown as CalculatorWorkflowFieldBuilderInput['setJobField'];
  const onOpenIssues = vi.fn();
  const onGenerate = vi.fn();
  const fields = buildCalculatorWorkflowFields({
    lightingEditorContent: 'lighting-content',
    lightingSummaryText: 'Eight lights',
    blindsListContent: 'blinds-content',
    blindsUi: { summaryText: 'Two blinds', totalEx: 100, totalInc: 115 },
    infillsTileContent: 'infills-content',
    infillsSummaryText: 'One infill',
    values: makeDefaultCalculatorInputs(),
    setJobField,
    derivedArea: 12.345,
    derivedRoofArea: 13.456,
    derivedAcrylicArea: 10,
    derivedTimberArea: 3.456,
    derivedAcrylicBaysTotal: 4,
    derivedPitchUsed: 5,
    derivedSlopeLength: 4.567,
    moduleResult: {},
    roofingProcurementSummary: 'Acrylic: 2 sheets',
    rafterCountTotal: 6,
    rafterProfile: '100x50',
    rafterHelperText: 'Per side: 3',
    bracketCount: 8,
    crewHours: 12,
    materialsEx: 1000,
    installEx: 500,
    overheadEx: 250,
    totalEx: 1750,
    totalInc: 2012.5,
    issuesCount: 2,
    onOpenIssues,
    result: {},
    warningsCount: 3,
    warningsHelperText: 'Review warnings',
    generateLabel: 'Save',
    onGenerate,
    projectId: 'project-1',
    generateError: null,
    isGenerating: false,
    hasStatusBlockers: false,
    resultFreshness: 'current',
    ...overrides,
  });
  return { fields, onGenerate, onOpenIssues, setJobField };
}

describe('calculator workflow fields', () => {
  it('builds editable standalone context and delegates its job fields', () => {
    const { fields, setJobField } = contextFields();

    expect(fieldById(fields, 'engine-status').value).toBe('Live');
    expect(fieldById(fields, 'project-context').value).toBe('None');
    expect(fieldById(fields, 'projectName').type).toBe('text');
    fieldById(fields, 'projectName').onChange?.('Standalone job');
    expect(setJobField).toHaveBeenCalledWith('projectName', 'Standalone job');
  });

  it('builds read-only project context and an optional draft notice', () => {
    const project = {
      id: 'project-1',
      projectName: 'Sanctuary project',
      quoteRef: 'Q-101',
    } as Project;
    const { fields } = contextFields({ project, projectId: project.id, draftNotice: 'Restored locally.' });

    expect(fieldById(fields, 'project-context').value).toBe('Sanctuary project');
    expect(fieldById(fields, 'projectName').type).toBe('readOnly');
    expect(fieldById(fields, 'quoteRef').value).toBe('Q-101');
    expect(fieldById(fields, 'draft-notice').helperText).toBe('Restored locally.');
  });

  it('builds custom, allowance, computed, issue, and save fields', () => {
    const { fields, onGenerate, onOpenIssues } = workflowFields();

    expect(fieldById(fields, 'lightingEditor').content).toBe('lighting-content');
    expect(fieldById(fields, 'blindsList').content).toBe('blinds-content');
    expect(fieldById(fields, 'infillsEditor').content).toBe('infills-content');
    expect(fieldById(fields, 'areaM2').value).toBe('12.35');
    expect(fieldById(fields, 'totalInc').value).toBe('$2012.50');
    expect(fieldById(fields, 'rafters').value).toBe('6 × 100x50');

    fieldById(fields, 'issues').onAction?.();
    fieldById(fields, 'generate-estimate').onAction?.();
    expect(onOpenIssues).toHaveBeenCalledOnce();
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('preserves discount clamping and save disabled state', () => {
    const { fields, setJobField } = workflowFields({
      issuesCount: 0,
      hasStatusBlockers: true,
    });

    expect(fields.some((field) => field.id === 'issues')).toBe(false);
    fieldById(fields, 'quoteDiscountPct').onChange?.('90');
    fieldById(fields, 'quoteDiscountPct').onChange?.('');
    expect(setJobField).toHaveBeenNthCalledWith(1, 'quoteDiscountPct', '80');
    expect(setJobField).toHaveBeenNthCalledWith(2, 'quoteDiscountPct', '');
    expect(fieldById(fields, 'generate-estimate').disabled).toBe(true);
  });
});
