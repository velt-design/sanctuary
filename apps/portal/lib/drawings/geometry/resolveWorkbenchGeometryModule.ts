import type { CostOutputV1 } from '@sp/costing';
import { getModuleCostOutputFromSnapshot, extractSnapshotOutputs } from '@/lib/costingAudit/viewModel';
import {
  estimateDrawingDraftTouchesGeometry,
  mergeEstimateDrawingDraftIntoSnapshot,
  resolveCalculatorInputsFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { solveActiveGeometryModuleResult } from './solveActiveGeometryModuleResult';

export type WorkbenchGeometryResultSource = 'snapshot' | 'local_resolve';

export type WorkbenchGeometryModuleResolveResult =
  | {
      ok: true;
      effectiveSnapshot: Record<string, unknown> | null;
      calculatorInputs: CalculatorInputs;
      module: CalculatorModuleInputs;
      moduleResult: CostOutputV1;
      resultSource: WorkbenchGeometryResultSource;
      draftTouchesGeometry: boolean;
    }
  | {
      ok: false;
      effectiveSnapshot: Record<string, unknown> | null;
      calculatorInputs: CalculatorInputs | null;
      module: CalculatorModuleInputs | null;
      resultSource: WorkbenchGeometryResultSource;
      draftTouchesGeometry: boolean;
      message: string;
    };

function hasStalePricingSyncState(snapshot: Record<string, unknown> | null): boolean {
  const outputs = extractSnapshotOutputs(snapshot);
  return outputs?.[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY] === 'stale';
}

export function resolveWorkbenchGeometryModule(input: {
  snapshot: Record<string, unknown> | null;
  draft?: EstimateDrawingDraft | null;
  moduleIndex: number;
  ignoreModuleResults?: boolean;
}): WorkbenchGeometryModuleResolveResult {
  const draftTouchesGeometry = estimateDrawingDraftTouchesGeometry(input.draft, input.snapshot);
  const effectiveSnapshot = mergeEstimateDrawingDraftIntoSnapshot(input.snapshot, input.draft);
  const calculatorInputs = resolveCalculatorInputsFromSnapshot(effectiveSnapshot);
  const resultSource: WorkbenchGeometryResultSource =
    input.ignoreModuleResults || draftTouchesGeometry || hasStalePricingSyncState(effectiveSnapshot)
      ? 'local_resolve'
      : 'snapshot';

  if (!calculatorInputs) {
    return {
      ok: false,
      effectiveSnapshot,
      calculatorInputs: null,
      module: null,
      resultSource,
      draftTouchesGeometry,
      message: 'Calculator inputs are not available for workbench geometry.',
    };
  }

  const module = calculatorInputs.modules[input.moduleIndex] ?? null;
  if (!module) {
    return {
      ok: false,
      effectiveSnapshot,
      calculatorInputs,
      module: null,
      resultSource,
      draftTouchesGeometry,
      message: 'The selected module is not available for workbench geometry.',
    };
  }

  const snapshotModuleResult = getModuleCostOutputFromSnapshot(effectiveSnapshot, input.moduleIndex);
  const shouldResolveLocally =
    resultSource === 'local_resolve' || !snapshotModuleResult;

  if (!shouldResolveLocally && snapshotModuleResult) {
    return {
      ok: true,
      effectiveSnapshot,
      calculatorInputs,
      module,
      moduleResult: snapshotModuleResult,
      resultSource: 'snapshot',
      draftTouchesGeometry,
    };
  }

  const localResult = solveActiveGeometryModuleResult({
    calculatorInputs,
    moduleIndex: input.moduleIndex,
  });

  if (!localResult.ok) {
    return {
      ok: false,
      effectiveSnapshot,
      calculatorInputs,
      module,
      resultSource: 'local_resolve',
      draftTouchesGeometry,
      message: localResult.message,
    };
  }

  return {
    ok: true,
    effectiveSnapshot,
    calculatorInputs,
    module,
    moduleResult: localResult.moduleResult,
    resultSource: 'local_resolve',
    draftTouchesGeometry,
  };
}
