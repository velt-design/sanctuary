import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import {
  DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
  type EstimateDrawingSheetMeta,
} from './drawingSheet';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
} from '@/lib/types/calculator';

type AnyRecord = Record<string, unknown>;

export const ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY = 'drawing_sheet_overrides';

export type EstimateDrawingOverrides = {
  noteOverride?: string | null;
  moduleTitleOverrides?: Record<string, string>;
};

export type EstimateDrawingDraft = {
  inputs: CalculatorInputs;
  overrides: EstimateDrawingOverrides;
};

export type EstimateDrawingFieldTarget =
  | {
      type: 'module_input';
      moduleIndex: number;
      field:
        | 'lengthM'
        | 'projectionM'
        | 'hipCornerLengthBM'
        | 'hipCornerProjectionBM'
        | 'roofPitchDeg'
        | 'postCutHeightM';
    }
  | {
      type: 'module_title';
      moduleIndex: number;
    }
  | {
      type: 'estimate_note';
    };

export type EstimateDrawingFieldEditor = 'singleline' | 'multiline';

export type EstimateDrawingField = {
  id: string;
  label: string;
  rawValue: string;
  displayValue: string;
  defaultValue?: string;
  svgFieldId?: string;
  editor: EstimateDrawingFieldEditor;
  target: EstimateDrawingFieldTarget;
};

export type EstimateDrawingFieldApplyResult =
  | {
      ok: true;
      draft: EstimateDrawingDraft;
    }
  | {
      ok: false;
      error: string;
    };

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

function formatPitch(value: number): string {
  return `${value.toFixed(1)} deg`;
}

function normalizeLengthInput(value: string): string {
  const parsed = Number.parseFloat(value);
  const rounded = Math.round(parsed * 1000) / 1000;
  return rounded.toFixed(3).replace(/\.?0+$/, '') || '0';
}

function normalizePitchInput(value: string): string {
  const parsed = Number.parseFloat(value);
  const rounded = Math.round(parsed * 10) / 10;
  return rounded.toFixed(1).replace(/\.?0+$/, '') || '0';
}

function normalizeOverrides(overrides: EstimateDrawingOverrides | null | undefined): EstimateDrawingOverrides {
  const noteOverride = asString(overrides?.noteOverride) ?? null;
  const moduleTitleOverrides = Object.fromEntries(
    Object.entries(overrides?.moduleTitleOverrides ?? {}).flatMap(([key, value]) => {
      const trimmed = asString(value);
      return trimmed ? [[key, trimmed]] : [];
    }),
  );

  return {
    ...(noteOverride ? { noteOverride } : null),
    ...(Object.keys(moduleTitleOverrides).length ? { moduleTitleOverrides } : null),
  };
}

export function stripClientFacingModulePrefix(value: string): string {
  return value.replace(/^\s*M\d+\s*-\s*/i, '').trim();
}

export function resolveCalculatorInputsFromSnapshot(snapshot: Record<string, unknown> | null): CalculatorInputs | null {
  if (!snapshot) return null;
  const rawInputs = snapshot.inputs ?? (isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot.inputs : null);
  if (isCalculatorInputsV2(rawInputs)) return cloneValue(rawInputs);
  if (isLegacyCalculatorInputsV1(rawInputs)) return migrateLegacyCalculatorInputsToV2(rawInputs);
  return null;
}

export function resolveEstimateDrawingOverridesFromSnapshot(snapshot: Record<string, unknown> | null): EstimateDrawingOverrides {
  if (!snapshot) return {};
  const outputs = isRecord(snapshot.outputs) ? snapshot.outputs : null;
  const raw = outputs && isRecord(outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY]) ? outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY] : null;
  return normalizeOverrides(raw as EstimateDrawingOverrides | null);
}

export function buildEstimateDrawingDraftFromSnapshot(snapshot: Record<string, unknown> | null): EstimateDrawingDraft | null {
  const inputs = resolveCalculatorInputsFromSnapshot(snapshot);
  if (!inputs) return null;
  return {
    inputs,
    overrides: resolveEstimateDrawingOverridesFromSnapshot(snapshot),
  };
}

export function estimateDrawingDraftMatchesSnapshot(
  draft: EstimateDrawingDraft | null | undefined,
  snapshot: Record<string, unknown> | null,
): boolean {
  const current = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft && !current) return true;
  if (!draft || !current) return false;
  return JSON.stringify(draft.inputs) === JSON.stringify(current.inputs) && JSON.stringify(normalizeOverrides(draft.overrides)) === JSON.stringify(normalizeOverrides(current.overrides));
}

export function estimateDrawingDraftTouchesGeometry(
  draft: EstimateDrawingDraft | null | undefined,
  snapshot: Record<string, unknown> | null,
): boolean {
  const current = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft || !current) return false;
  return JSON.stringify(draft.inputs) !== JSON.stringify(current.inputs);
}

export function resolveEstimateDrawingNoteValue(overrides: EstimateDrawingOverrides | null | undefined): string {
  return asString(overrides?.noteOverride) ?? DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE;
}

export function resolveEstimateDrawingModuleTitleValue(
  moduleLabel: string,
  overrides: EstimateDrawingOverrides | null | undefined,
  moduleIndex: number,
): string {
  const override = overrides?.moduleTitleOverrides?.[String(moduleIndex)];
  return asString(override) ?? stripClientFacingModulePrefix(moduleLabel);
}

export function mergeEstimateDrawingDraftIntoSnapshot(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft | null | undefined,
): Record<string, unknown> | null {
  if (!snapshot && !draft) return null;
  const next = cloneValue((snapshot ?? { inputs: {}, outputs: {}, warnings: [] }) as Record<string, unknown>);
  if (!draft) return next;
  next.inputs = cloneValue(draft.inputs) as unknown as Record<string, unknown>;

  const outputs = isRecord(next.outputs) ? cloneValue(next.outputs) : {};
  const normalizedOverrides = normalizeOverrides(draft.overrides);
  if (Object.keys(normalizedOverrides).length) {
    outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY] = normalizedOverrides;
  } else {
    delete outputs[ESTIMATE_DRAWING_OVERRIDES_OUTPUT_KEY];
  }
  next.outputs = outputs;
  return next;
}

export function buildEstimateDrawingSheetMetaOverrides(input: {
  moduleLabel: string;
  moduleIndex: number;
  draft: EstimateDrawingDraft | null | undefined;
}): Pick<EstimateDrawingSheetMeta, 'moduleTitle' | 'note'> {
  return {
    moduleTitle: resolveEstimateDrawingModuleTitleValue(input.moduleLabel, input.draft?.overrides, input.moduleIndex),
    note: resolveEstimateDrawingNoteValue(input.draft?.overrides),
  };
}

export function deriveEstimateDrawingEditableFields(input: {
  draft: EstimateDrawingDraft | null;
  moduleIndex: number;
  moduleLabel: string;
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
}): EstimateDrawingField[] {
  if (!input.draft) return [];
  const module = input.draft.inputs.modules[input.moduleIndex];
  if (!module) return [];

  const fields: EstimateDrawingField[] = [
    {
      id: 'meta:note',
      label: 'Drawing note',
      rawValue: resolveEstimateDrawingNoteValue(input.draft.overrides),
      displayValue: resolveEstimateDrawingNoteValue(input.draft.overrides),
      defaultValue: DEFAULT_ESTIMATE_DRAWING_SHEET_NOTE,
      editor: 'multiline',
      target: { type: 'estimate_note' },
    },
  ];

  if (input.view === 'plan') {
    fields.push(
      {
        id: 'plan:lengthA',
        label: 'Plan length',
        rawValue: asString(module.lengthM) ?? (input.planModel ? String(input.planModel.lengthA) : ''),
        displayValue: input.planModel ? formatMetres(input.planModel.lengthA) : formatMetres(toNumber(module.lengthM)),
        svgFieldId: 'plan:lengthA',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'lengthM' },
      },
      {
        id: 'plan:spanA',
        label: 'Plan span',
        rawValue: asString(module.projectionM) ?? (input.planModel ? String(input.planModel.spanA) : ''),
        displayValue: input.planModel ? formatMetres(input.planModel.spanA) : formatMetres(toNumber(module.projectionM)),
        svgFieldId: 'plan:spanA',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'projectionM' },
      },
    );

    if (input.planModel?.roofType === 'hip_corner' && input.planModel.lengthB && input.planModel.spanB) {
      fields.push(
        {
          id: 'plan:lengthB',
          label: 'Plan length B',
          rawValue: asString(module.hipCornerLengthBM) ?? String(input.planModel.lengthB),
          displayValue: formatMetres(input.planModel.lengthB),
          svgFieldId: 'plan:lengthB',
          editor: 'singleline',
          target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'hipCornerLengthBM' },
        },
        {
          id: 'plan:spanB',
          label: 'Plan span B',
          rawValue: asString(module.hipCornerProjectionBM) ?? String(input.planModel.spanB),
          displayValue: formatMetres(input.planModel.spanB),
          svgFieldId: 'plan:spanB',
          editor: 'singleline',
          target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'hipCornerProjectionBM' },
        },
      );
    }

    return fields;
  }

  if (!input.sectionModel) return fields;

  fields.push(
    {
      id: 'section:spanA',
      label: 'Section span',
      rawValue: asString(module.projectionM) ?? String(input.sectionModel.spanA),
      displayValue: formatMetres(input.sectionModel.spanA),
      svgFieldId: 'section:spanA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'projectionM' },
    },
    {
      id: 'section:pitch',
      label: 'Roof pitch',
      rawValue: asString(module.roofPitchDeg) ?? input.sectionModel.pitchDeg.toFixed(1),
      displayValue: formatPitch(input.sectionModel.pitchDeg),
      svgFieldId: 'section:pitch',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'roofPitchDeg' },
    },
  );

  if (input.sectionModel.sectionKind === 'gable') {
    fields.push(
      {
        id: 'section:heightLeft',
        label: 'Left height',
        rawValue: asString(module.postCutHeightM) ?? String(input.sectionModel.leftEdgeHeightM),
        displayValue: formatMetres(input.sectionModel.leftEdgeHeightM),
        svgFieldId: 'section:heightLeft',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
      },
      {
        id: 'section:heightRight',
        label: 'Right height',
        rawValue: asString(module.postCutHeightM) ?? String(input.sectionModel.rightEdgeHeightM),
        displayValue: formatMetres(input.sectionModel.rightEdgeHeightM),
        svgFieldId: 'section:heightRight',
        editor: 'singleline',
        target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
      },
    );
    return fields;
  }

  const baseHeightFieldId = input.sectionModel.slopeDirection === 'toward_house' ? 'section:heightRight' : 'section:heightLeft';
  const baseHeightDisplay = input.sectionModel.slopeDirection === 'toward_house'
    ? input.sectionModel.rightEdgeHeightM
    : input.sectionModel.leftEdgeHeightM;

  fields.push({
    id: baseHeightFieldId,
    label: 'Base height',
    rawValue: asString(module.postCutHeightM) ?? String(baseHeightDisplay),
    displayValue: formatMetres(baseHeightDisplay),
    svgFieldId: baseHeightFieldId,
    editor: 'singleline',
    target: { type: 'module_input', moduleIndex: input.moduleIndex, field: 'postCutHeightM' },
  });

  return fields;
}

export function applyEstimateDrawingFieldEdit(input: {
  draft: EstimateDrawingDraft;
  field: EstimateDrawingField;
  nextValue: string;
}): EstimateDrawingFieldApplyResult {
  const nextDraft = cloneValue(input.draft);
  const moduleIndex = 'moduleIndex' in input.field.target ? input.field.target.moduleIndex : -1;

  if (input.field.target.type === 'module_title') {
    const trimmed = input.nextValue.trim();
    const moduleTitleOverrides = { ...(nextDraft.overrides.moduleTitleOverrides ?? {}) };
    if (!trimmed || trimmed === input.field.defaultValue) {
      delete moduleTitleOverrides[String(input.field.target.moduleIndex)];
    } else {
      moduleTitleOverrides[String(input.field.target.moduleIndex)] = trimmed;
    }
    nextDraft.overrides = normalizeOverrides({
      ...nextDraft.overrides,
      moduleTitleOverrides,
    });
    return { ok: true, draft: nextDraft };
  }

  if (input.field.target.type === 'estimate_note') {
    const trimmed = input.nextValue.trim();
    nextDraft.overrides = normalizeOverrides({
      ...nextDraft.overrides,
      noteOverride: trimmed && trimmed !== input.field.defaultValue ? trimmed : null,
    });
    return { ok: true, draft: nextDraft };
  }

  const module = nextDraft.inputs.modules[moduleIndex];
  if (!module) return { ok: false, error: 'This drawing field no longer maps to a module input.' };

  if (input.field.target.field === 'roofPitchDeg') {
    const pitch = Number.parseFloat(input.nextValue);
    if (!Number.isFinite(pitch) || pitch < 0 || pitch > 85) {
      return { ok: false, error: 'Enter a pitch between 0 and 85.' };
    }
    module.roofPitchDeg = normalizePitchInput(input.nextValue);
    return { ok: true, draft: nextDraft };
  }

  const parsed = Number.parseFloat(input.nextValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: 'Enter a value greater than 0.' };
  }

  module[input.field.target.field] = normalizeLengthInput(input.nextValue);
  return { ok: true, draft: nextDraft };
}
