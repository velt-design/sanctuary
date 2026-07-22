import type {
  CalculatorInputs,
  CalculatorModuleInputs,
  CalculatorPergola,
} from '@/lib/types/calculator';
import { makeFlashingId } from './calculatorFlashings';
import {
  formatInputNumber,
  getPergolaLabel,
  makeDefaultModule,
  makeInfillId,
  nextPergola,
  normalizePergolasForUi,
  prunePergolasForModules,
} from './calculatorInputs';

type CalculatorModuleIssueMap = Partial<Record<keyof CalculatorModuleInputs, string>>;

export type CalculatorModuleNavigatorItem = {
  key: string;
  moduleIndex: number;
  pergolaId: string;
  pergolaLabel: string;
  localModuleIndex: number;
  label: string;
  styleLabel: string;
  dimensionsLabel: string;
  issueCount: number;
  isActive: boolean;
};

type CalculatorModuleNavigatorGroup = {
  pergolaId: string;
  label: string;
  items: CalculatorModuleNavigatorItem[];
};

export type CalculatorModuleNavigatorModel = {
  groups: CalculatorModuleNavigatorGroup[];
  items: CalculatorModuleNavigatorItem[];
  activeModuleLabel: string;
  totalIssueCount: number;
};

type CalculatorModuleMutationResult = {
  values: CalculatorInputs;
  activeModuleIndex: number;
};

const STYLE_LABELS: Record<CalculatorModuleInputs['pergolaStyle'], string> = {
  pitched: 'Pitched',
  gable: 'Gable',
  hip: 'Hip',
  hip_corner: 'Hip corner',
  box_perimeter: 'Box perimeter',
};

function safeActiveModuleIndex(values: CalculatorInputs, activeModuleIndex: number): number {
  return Math.min(Math.max(0, activeModuleIndex), Math.max(0, values.modules.length - 1));
}

function dimensionLabel(value: string): string {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '—';
  return `${formatInputNumber(parsed, 2)}m`;
}

function calculatorModuleStyleLabel(module: CalculatorModuleInputs): string {
  const styleLabel = STYLE_LABELS[module.pergolaStyle] ?? module.pergolaStyle;
  return module.boxPerimeterEnabled && module.pergolaStyle !== 'box_perimeter'
    ? `${styleLabel} + box perimeter`
    : styleLabel;
}

function calculatorModuleDimensionsLabel(module: CalculatorModuleInputs): string {
  const primary = `${dimensionLabel(module.lengthM)} × ${dimensionLabel(module.projectionM)}`;
  if (module.pergolaStyle !== 'hip_corner') return primary;
  return `A ${primary} · B ${dimensionLabel(module.hipCornerLengthBM)} × ${dimensionLabel(module.hipCornerProjectionBM)}`;
}

export function buildCalculatorModuleNavigatorModel({
  values,
  activeModuleIndex,
  errorsByModule,
}: {
  values: CalculatorInputs;
  activeModuleIndex: number;
  errorsByModule: CalculatorModuleIssueMap[];
}): CalculatorModuleNavigatorModel {
  const pergolas = normalizePergolasForUi(values.pergolas);
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const knownPergolaIds = new Set(pergolas.map((pergola) => pergola.id));
  const groups = pergolas.map<CalculatorModuleNavigatorGroup>((pergola) => ({
    pergolaId: pergola.id,
    label: pergola.label,
    items: [],
  }));
  const groupsById = new Map(groups.map((group) => [group.pergolaId, group]));
  const seenPerPergola = new Map<string, number>();
  const safeActiveIndex = safeActiveModuleIndex(values, activeModuleIndex);

  const items = values.modules.map<CalculatorModuleNavigatorItem>((module, moduleIndex) => {
    const pergolaId = typeof module.pergolaId === 'string' && knownPergolaIds.has(module.pergolaId)
      ? module.pergolaId
      : fallbackPergolaId;
    const localModuleIndex = seenPerPergola.get(pergolaId) ?? 0;
    seenPerPergola.set(pergolaId, localModuleIndex + 1);
    const pergolaLabel = getPergolaLabel(pergolas, pergolaId, moduleIndex);
    const item: CalculatorModuleNavigatorItem = {
      key: `${pergolaId}:${moduleIndex}`,
      moduleIndex,
      pergolaId,
      pergolaLabel,
      localModuleIndex,
      label: `${pergolaLabel} · Module ${localModuleIndex + 1}`,
      styleLabel: calculatorModuleStyleLabel(module),
      dimensionsLabel: calculatorModuleDimensionsLabel(module),
      issueCount: Object.values(errorsByModule[moduleIndex] ?? {}).filter(Boolean).length,
      isActive: moduleIndex === safeActiveIndex,
    };
    groupsById.get(pergolaId)?.items.push(item);
    return item;
  });

  return {
    groups,
    items,
    activeModuleLabel: items[safeActiveIndex]?.label ?? 'No module selected',
    totalIssueCount: items.reduce((total, item) => total + item.issueCount, 0),
  };
}

function withNormalizedPergolas(values: CalculatorInputs): CalculatorInputs {
  return { ...values, pergolas: normalizePergolasForUi(values.pergolas) };
}

export function addCalculatorModule(
  values: CalculatorInputs,
  activeModuleIndex: number,
  targetPergolaId: string,
): CalculatorModuleMutationResult {
  const normalized = withNormalizedPergolas(values);
  const fallbackPergolaId = normalized.pergolas?.[0]?.id ?? 'pergola-1';
  const pergolaId = normalized.pergolas?.some((pergola) => pergola.id === targetPergolaId)
    ? targetPergolaId
    : fallbackPergolaId;
  const nextModuleIndex = normalized.modules.length;
  return {
    values: { ...normalized, modules: [...normalized.modules, makeDefaultModule(pergolaId)] },
    activeModuleIndex: nextModuleIndex,
  };
}

function duplicateModuleInputs(source: CalculatorModuleInputs): CalculatorModuleInputs {
  const duplicate = structuredClone(source);
  if (duplicate.flashings) {
    duplicate.flashings = {
      rows: duplicate.flashings.rows.map((row) => ({ ...row, id: makeFlashingId() })),
    };
  }
  if (duplicate.infills) {
    duplicate.infills = {
      items: duplicate.infills.items.map((item) => ({ ...item, id: makeInfillId() })),
    };
  }
  return duplicate;
}

export function duplicateCalculatorModule(
  values: CalculatorInputs,
  activeModuleIndex: number,
  sourceModuleIndex: number,
): CalculatorModuleMutationResult {
  const source = values.modules[sourceModuleIndex];
  if (!source) return { values, activeModuleIndex: safeActiveModuleIndex(values, activeModuleIndex) };
  const nextModuleIndex = values.modules.length;
  return {
    values: { ...values, modules: [...values.modules, duplicateModuleInputs(source)] },
    activeModuleIndex: nextModuleIndex,
  };
}

export function addCalculatorPergola(
  values: CalculatorInputs,
  activeModuleIndex: number,
): CalculatorModuleMutationResult {
  const normalized = withNormalizedPergolas(values);
  const pergola = nextPergola(normalized);
  const nextModuleIndex = normalized.modules.length;
  return {
    values: {
      ...normalized,
      pergolas: [...(normalized.pergolas ?? []), pergola],
      modules: [...normalized.modules, makeDefaultModule(pergola.id)],
    },
    activeModuleIndex: nextModuleIndex,
  };
}

export function moveCalculatorModule(
  values: CalculatorInputs,
  activeModuleIndex: number,
  moduleIndex: number,
  targetPergolaId: string,
): CalculatorModuleMutationResult {
  const pergolas = normalizePergolasForUi(values.pergolas);
  if (!pergolas.some((pergola) => pergola.id === targetPergolaId) || !values.modules[moduleIndex]) {
    return { values, activeModuleIndex: safeActiveModuleIndex(values, activeModuleIndex) };
  }
  const modules = values.modules.slice();
  modules[moduleIndex] = { ...modules[moduleIndex], pergolaId: targetPergolaId };
  return {
    values: { ...values, pergolas, modules },
    activeModuleIndex: safeActiveModuleIndex(values, activeModuleIndex),
  };
}

export function removeCalculatorModule(
  values: CalculatorInputs,
  activeModuleIndex: number,
  moduleIndex: number,
): CalculatorModuleMutationResult {
  if (values.modules.length <= 1 || !values.modules[moduleIndex]) {
    return { values, activeModuleIndex: safeActiveModuleIndex(values, activeModuleIndex) };
  }

  const modules = values.modules.slice();
  modules.splice(moduleIndex, 1);
  const pergolas = prunePergolasForModules(values.pergolas, modules);
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const knownPergolaIds = new Set(pergolas.map((pergola) => pergola.id));
  const normalizedModules = modules.map((module) =>
    typeof module.pergolaId === 'string' && knownPergolaIds.has(module.pergolaId)
      ? module
      : { ...module, pergolaId: fallbackPergolaId },
  );

  let nextActiveModuleIndex = activeModuleIndex;
  if (moduleIndex < activeModuleIndex) nextActiveModuleIndex -= 1;
  else if (moduleIndex === activeModuleIndex) nextActiveModuleIndex = Math.min(moduleIndex, normalizedModules.length - 1);

  return {
    values: { ...values, pergolas, modules: normalizedModules },
    activeModuleIndex: Math.max(0, nextActiveModuleIndex),
  };
}

export function calculatorPergolaOptions(values: CalculatorInputs): CalculatorPergola[] {
  return normalizePergolasForUi(values.pergolas);
}

export function renameCalculatorPergola(
  values: CalculatorInputs,
  pergolaId: string,
  nextLabel: string,
): CalculatorInputs {
  const pergolas = normalizePergolasForUi(values.pergolas);
  const index = pergolas.findIndex((pergola) => pergola.id === pergolaId);
  if (index < 0) return values;
  const trimmed = nextLabel.trim();
  if (!trimmed || trimmed === pergolas[index]?.label) return { ...values, pergolas };
  const updated = pergolas.slice();
  updated[index] = { ...updated[index], label: trimmed };
  return { ...values, pergolas: updated };
}
