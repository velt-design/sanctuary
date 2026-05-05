import type { CostInputsV1, CostOutputV1, InstallActionV1, MaterialsExplainV1, MaterialsLineExplain, WarningV1 } from '@sp/costing';
import { type EstimateDetail } from '@/lib/estimates/types';
import { buildModuleCostInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, migrateLegacyCalculatorInputsToV2, type CalculatorInputs } from '@/lib/types/calculator';

type AnyRecord = Record<string, unknown>;

type CostingAuditSummaryRow = {
  id: string;
  section: string;
  metric: string;
  value: string;
  source: string;
  notes?: string | null;
};

type CostingAuditMaterialsRow = {
  line: number;
  itemId: string;
  label: string;
  qty: number | null;
  unit: string | null;
  unitCost: number | null;
  lineCost: number | null;
  why: string | null;
  dependsOn: string[];
  source: string | null;
};

type CostingAuditInstallRow = {
  actionId: string;
  category: string | null;
  label: string;
  scope: string | null;
  qty: number | null;
  unit: string | null;
  minutes: number | null;
  cost: number | null;
  why: string | null;
  dependsOn: string[];
  source: string | null;
};

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  return `$${value.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString();
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}

function formatDependencyValue(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : 'n/a';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatDependencyValue).join(', ');
  if (isRecord(value)) return Object.keys(value).join(', ');
  if (value == null) return 'n/a';
  return String(value);
}

function summarizeDependencies(record: Record<string, unknown> | undefined, limit = 4): string[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, limit)
    .map(([key, value]) => `${key}=${formatDependencyValue(value)}`);
}

function collectSnapshotWarnings(snapshot: Record<string, unknown> | null): WarningV1[] {
  const outputs = extractSnapshotOutputs(snapshot);
  const explicitWarnings = Array.isArray((outputs as any)?.warnings) ? ((outputs as any).warnings as WarningV1[]) : [];
  if (explicitWarnings.length) return explicitWarnings;
  const totalsWarnings = Array.isArray((outputs as any)?.totals?.warnings) ? ((outputs as any).totals.warnings as WarningV1[]) : [];
  if (totalsWarnings.length) return totalsWarnings;
  const notes = Array.isArray((outputs as any)?.totals?.notes_and_warnings) ? (outputs as any).totals.notes_and_warnings : [];
  return notes
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .map((message: string) => ({ level: 'info', message }));
}

function extractCalculatorInputsFromSnapshot(snapshot: Record<string, unknown> | null): CalculatorInputs | null {
  const root = isRecord(snapshot?.calculator_snapshot) ? (snapshot?.calculator_snapshot as AnyRecord) : snapshot;
  const inputs = root?.inputs;
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  return null;
}

export function extractSnapshotOutputs(snapshot: Record<string, unknown> | null): AnyRecord | null {
  const root = isRecord(snapshot?.calculator_snapshot) ? (snapshot?.calculator_snapshot as AnyRecord) : snapshot;
  return isRecord(root?.outputs) ? (root.outputs as AnyRecord) : null;
}

export function buildModuleCostInputsFromSnapshot(snapshot: Record<string, unknown> | null, moduleIndex: number): CostInputsV1 | null {
  const inputs = extractCalculatorInputsFromSnapshot(snapshot);
  if (!inputs) return null;
  return buildModuleCostInputsFromCalculatorInputs(inputs, moduleIndex);
}

export function getModuleCostOutputFromSnapshot(snapshot: Record<string, unknown> | null, moduleIndex: number): CostOutputV1 | null {
  const outputs = extractSnapshotOutputs(snapshot);
  if (!outputs) return null;

  const pergolas = Array.isArray(outputs.pergolas) ? outputs.pergolas : [];
  const modules = pergolas.flatMap((pergola) => (Array.isArray((pergola as any)?.modules) ? (pergola as any).modules : []));
  const moduleOutput = modules[moduleIndex];
  if (isRecord(moduleOutput)) return moduleOutput as CostOutputV1;

  if (moduleIndex === 0 && isRecord(outputs.materials) && isRecord(outputs.install) && isRecord(outputs.totals)) {
    return outputs as unknown as CostOutputV1;
  }

  return null;
}

function getSummaryTotal(detail: EstimateDetail, key: 'materials' | 'install' | 'overhead' | 'totalEx' | 'totalInc'): number | null {
  const outputs = extractSnapshotOutputs(detail.calculatorSnapshot);
  if (key === 'materials') return readNumber((outputs as any)?.materials?.totals?.materials_ex_gst);
  if (key === 'install') return readNumber((outputs as any)?.install?.totals?.install_ex_gst);
  if (key === 'overhead') return readNumber((outputs as any)?.overhead?.total_ex_gst);
  if (key === 'totalEx') return readNumber((outputs as any)?.totals?.cost_ex_gst) ?? readNumber(detail.summary?.cost);
  return readNumber((outputs as any)?.totals?.cost_inc_gst) ?? readNumber(detail.summary?.total);
}

export function buildCostingAuditSummaryRows(detail: EstimateDetail): CostingAuditSummaryRow[] {
  const warnings = collectSnapshotWarnings(detail.calculatorSnapshot);
  const notes = warnings.map((warning) => `[${warning.level}] ${warning.message}`).join(' | ');

  return [
    {
      id: 'estimate-version',
      section: 'Estimate',
      metric: 'Version',
      value: detail.versionLabel,
      source: 'estimate detail',
      notes: null,
    },
    {
      id: 'estimate-created',
      section: 'Estimate',
      metric: 'Created',
      value: formatDateTime(detail.createdAt),
      source: 'estimate detail',
      notes: null,
    },
    {
      id: 'config-manifest',
      section: 'Config',
      metric: 'Manifest',
      value: detail.calculatorSnapshot && typeof (detail.calculatorSnapshot as any)?.costing_manifest === 'string'
        ? String((detail.calculatorSnapshot as any).costing_manifest)
        : 'Not available',
      source: 'snapshot.costing_manifest',
      notes: null,
    },
    {
      id: 'config-rules',
      section: 'Config',
      metric: 'Rules',
      value: detail.calculatorSnapshot && typeof (detail.calculatorSnapshot as any)?.costing_rules === 'string'
        ? String((detail.calculatorSnapshot as any).costing_rules)
        : 'Not available',
      source: 'snapshot.costing_rules',
      notes: null,
    },
    {
      id: 'totals-materials',
      section: 'Totals',
      metric: 'Materials ex GST',
      value: formatMoney(getSummaryTotal(detail, 'materials')),
      source: 'outputs.materials.totals',
      notes: null,
    },
    {
      id: 'totals-install',
      section: 'Totals',
      metric: 'Install ex GST',
      value: formatMoney(getSummaryTotal(detail, 'install')),
      source: 'outputs.install.totals',
      notes: null,
    },
    {
      id: 'totals-overhead',
      section: 'Totals',
      metric: 'Overhead ex GST',
      value: formatMoney(getSummaryTotal(detail, 'overhead')),
      source: 'outputs.overhead',
      notes: null,
    },
    {
      id: 'totals-total-ex',
      section: 'Totals',
      metric: 'Total ex GST',
      value: formatMoney(getSummaryTotal(detail, 'totalEx')),
      source: 'outputs.totals',
      notes: null,
    },
    {
      id: 'totals-total-inc',
      section: 'Totals',
      metric: 'Total inc GST',
      value: formatMoney(getSummaryTotal(detail, 'totalInc')),
      source: 'outputs.totals',
      notes: null,
    },
    {
      id: 'warnings-count',
      section: 'Warnings',
      metric: 'Count',
      value: String(warnings.length),
      source: 'outputs.warnings',
      notes: warnings.length ? notes : 'No warnings recorded.',
    },
  ];
}

function mapExplainLineById(explain: MaterialsExplainV1 | null | undefined): Map<string, MaterialsLineExplain> {
  const map = new Map<string, MaterialsLineExplain>();
  if (!explain) return map;
  for (const explainLine of Object.values(explain.lines ?? {})) {
    if (!explainLine?.line_id) continue;
    map.set(String(explainLine.line_id), explainLine);
  }
  return map;
}

function describeMaterialsLine(
  explainLine: MaterialsLineExplain | undefined,
  explain: MaterialsExplainV1 | null | undefined,
): { why: string | null; dependsOn: string[]; source: string | null } {
  if (!explainLine) {
    return {
      why: null,
      dependsOn: [],
      source: null,
    };
  }

  if (explainLine.kind === 'extrusion_bar') {
    const group = explain?.cut_groups?.[explainLine.cut_group_key];
    const components = Array.isArray(group?.components) ? group.components.filter(Boolean) : [];
    const stockLength = group?.selection?.chosen?.stock_length_m;
    return {
      why: group?.selection?.rule
        ? `Extrusion stock selected by ${group.selection.rule}.`
        : `Extrusion bar generated from cut group ${explainLine.cut_group_key}.`,
      dependsOn: [
        ...(components.length ? [`components=${components.join(', ')}`] : []),
        ...(typeof stockLength === 'number' ? [`stock_length_m=${stockLength}`] : []),
      ],
      source: `cut group ${explainLine.cut_group_key}`,
    };
  }

  if (explainLine.kind === 'acrylic_sheet_or_strip') {
    return {
      why: explainLine.formula || 'Acrylic quantity derived from material rule.',
      dependsOn: summarizeDependencies(explainLine.deps),
      source: 'materials formula',
    };
  }

  if (explainLine.kind === 'rule_hardware') {
    return {
      why: explainLine.applied
        ? `Included because hardware rule ${explainLine.rule_id} applied.`
        : `Hardware rule ${explainLine.rule_id} did not apply.`,
      dependsOn: [
        ...summarizeDependencies(explainLine.vars_used),
        ...summarizeDependencies(explainLine.applies_when),
      ],
      source: `rule ${explainLine.rule_id}`,
    };
  }

  return {
    why: explainLine.formula || 'Included by fixed BOM line.',
    dependsOn: summarizeDependencies(explainLine.deps),
    source: 'fixed BOM line',
  };
}

export function buildCostingAuditMaterialsRows(
  moduleOutput: CostOutputV1 | null,
  explain: MaterialsExplainV1 | null | undefined,
): CostingAuditMaterialsRow[] {
  const lines = Array.isArray(moduleOutput?.materials?.lines) ? moduleOutput.materials.lines : [];
  const explainById = mapExplainLineById(explain);

  return lines.map((line, index) => {
    const explainLine = explainById.get(String(line.id)) ?? Object.values(explain?.lines ?? {}).find((item) => item.line_index === index);
    const described = describeMaterialsLine(explainLine, explain);

    return {
      line: index + 1,
      itemId: line.id,
      label: line.label,
      qty: readNumber(line.qty),
      unit: line.unit ?? null,
      unitCost: readNumber(line.unit_cost_ex_gst),
      lineCost: readNumber(line.line_cost_ex_gst),
      why: described.why,
      dependsOn: described.dependsOn,
      source: described.source,
    };
  });
}

function inferInstallWhy(action: InstallActionV1): string {
  const reasons: string[] = [];
  if ((action.scope ?? 'module') === 'job') {
    reasons.push('Job-scoped action included once.');
  } else {
    reasons.push('Included because resolved quantity was greater than zero.');
  }

  if (typeof action.qty === 'number' && Number.isFinite(action.qty)) {
    reasons.push(`Resolved qty ${Math.round(action.qty * 1000) / 1000} ${action.unit}.`);
  }

  if (typeof action.applied_multipliers?.steel_beam === 'number' && action.applied_multipliers.steel_beam > 1) {
    reasons.push('Steel beam multiplier applied.');
  } else if (Object.keys(action.applied_multipliers ?? {}).length > 0) {
    reasons.push('Additional multipliers applied.');
  }

  return reasons.join(' ');
}

export function buildCostingAuditInstallRows(detail: EstimateDetail): CostingAuditInstallRow[] {
  const outputs = extractSnapshotOutputs(detail.calculatorSnapshot);
  const actions = Array.isArray((outputs as any)?.install?.actions) ? ((outputs as any).install.actions as InstallActionV1[]) : [];

  return actions.map((action) => {
    const multipliers = Object.entries(action.applied_multipliers ?? {})
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
      .map(([key, value]) => `${titleize(key)} x${Math.round(value * 100) / 100}`);

    return {
      actionId: action.id,
      category: action.category ?? null,
      label: action.label,
      scope: action.scope ?? 'module',
      qty: readNumber(action.qty),
      unit: action.unit ?? null,
      minutes: readNumber(action.minutes),
      cost: readNumber(action.cost_ex_gst),
      why: inferInstallWhy(action),
      dependsOn: [`scope=${action.scope ?? 'module'}`, `qty=${formatDependencyValue(action.qty)}`, ...multipliers],
      source: `install action ${action.id}`,
    };
  });
}
