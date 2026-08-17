import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  formatModuleColour,
  formatModulePitch,
  formatModulePosts,
  formatModuleRoof,
  formatModuleSize,
  formatModuleStyle,
  toTitleCase,
} from './moduleFormatters';

function uniqueModuleStyles(modules: CalculatorModuleInputs[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  modules.forEach((module) => {
    const raw = typeof module?.pergolaStyle === 'string' ? module.pergolaStyle.trim() : '';
    if (!raw) return;
    const normalized = raw.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(toTitleCase(normalized));
  });

  return ordered;
}

function joinStyleLabels(styles: string[]): string {
  if (!styles.length) return 'Custom';
  if (styles.length === 1) return styles[0]!;
  if (styles.length === 2) return `${styles[0]} + ${styles[1]}`;
  return `${styles.slice(0, -1).join(', ')} + ${styles[styles.length - 1]}`;
}

const PERGOLA_INCLUDED_SCOPE = 'Custom-designed pergola, supplied and installed';

function formatCustomerRoof(module: CalculatorModuleInputs): string | null {
  if (module.roofMaterial === 'acrylic') {
    return 'Acrylic roofing — admits natural light while adding overhead shelter';
  }
  if (module.roofMaterial === 'none') {
    return 'Open pergola structure — roof covering excluded';
  }

  const solidRoof = module.timberRoofAboveType === 'steel_corrugated'
    ? 'corrugated steel roofing'
    : module.timberRoofAboveType === 'steel_tray'
      ? 'tray roofing'
      : 'insulated roof panels';

  if (module.roofMaterial === 'mixed') {
    return `Mixed roof with acrylic and ${solidRoof}`;
  }
  if (module.roofMaterial === 'timber') {
    return `Timber-framed roof with ${solidRoof}`;
  }
  return formatModuleRoof(module);
}

export function normalizePergolaId(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizePergolaLabel(value: unknown, fallbackIndex: number): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `Pergola ${fallbackIndex + 1}`;
}

type ModuleField = {
  key: 'roof' | 'colour' | 'houseConnection' | 'postFixings';
  label: string;
  value: string | null;
};

function normalizeComparisonValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function formatConnectionValue(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return null;
  if (normalized === 'deck_bracket') return 'Deck brackets';
  if (normalized === 'soffit') return 'Soffit brackets';
  if (normalized === 'pile_1m') return '1m pile foundations';
  if (normalized === 'pile_1_5m') return '1.5m pile foundations';
  if (normalized === 'slab_anchors') return 'Slab anchors';
  if (normalized === 'none') return 'None (freestanding)';
  return toTitleCase(normalized);
}

function buildSharedCandidateFields(module: CalculatorModuleInputs): ModuleField[] {
  return [
    { key: 'roof', label: 'Roof covering', value: formatCustomerRoof(module) },
    { key: 'colour', label: 'Frame finish', value: formatModuleColour(module) },
    { key: 'houseConnection', label: 'Connection to home', value: formatConnectionValue(module.houseConnectionType) },
    { key: 'postFixings', label: 'Post foundations and fixings', value: formatConnectionValue(module.postConnectionType) },
  ];
}

function appendFieldLine(lines: string[], label: string, value: string | null) {
  if (!value) return;
  lines.push(`- ${label}: ${value}`);
}

function formatInfillSize(item: NonNullable<CalculatorModuleInputs['infills']>['items'][number]): string | null {
  const shape = item.shape;
  if (!shape) return null;
  const width = shape.widthM?.trim();
  if (!width) return null;
  if (shape.type === 'rect') {
    const height = shape.heightM?.trim();
    return height ? `${width}m × ${height}m` : `${width}m wide`;
  }
  const low = shape.heightLowM?.trim();
  const high = shape.heightHighM?.trim();
  return low && high ? `${width}m × ${low}–${high}m high` : `${width}m wide`;
}

function appendIncludedInfills(lines: string[], module: CalculatorModuleInputs) {
  const infills = module.infills?.items ?? [];
  if (!infills.length) return;
  lines.push('', 'Included infills');
  infills.forEach((item, index) => {
    const label = item.label?.trim() || `Infill ${index + 1}`;
    const size = formatInfillSize(item);
    const quantity = Number(item.qty) > 1 ? `; quantity ${item.qty}` : '';
    lines.push(`- ${label}${size ? `: ${size}` : ''}${quantity}`);
  });
}

export function buildInputPergolaModules(
  inputs: CalculatorInputs | null,
): Array<{ id: string; label: string; modules: CalculatorModuleInputs[] }> {
  const modules = Array.isArray(inputs?.modules) ? inputs.modules : [];
  if (!modules.length) return [];

  const rawPergolas = Array.isArray((inputs as any)?.pergolas) ? ((inputs as any).pergolas as Array<{ id?: unknown; label?: unknown }>) : [];
  const pergolas = rawPergolas.length
    ? rawPergolas.map((p, idx) => ({
        id: normalizePergolaId(p?.id, `pergola-${idx + 1}`),
        label: normalizePergolaLabel(p?.label, idx),
      }))
    : [{ id: 'pergola-1', label: 'Pergola 1' }];

  const knownPergolaIds = new Set(pergolas.map((p) => p.id));
  const fallbackPergolaId = pergolas[0]?.id ?? 'pergola-1';
  const byPergola = new Map<string, CalculatorModuleInputs[]>();
  pergolas.forEach((pergola) => byPergola.set(pergola.id, []));

  for (const module of modules) {
    const assignedId = typeof module?.pergolaId === 'string' && knownPergolaIds.has(module.pergolaId) ? module.pergolaId : fallbackPergolaId;
    const bucket = byPergola.get(assignedId);
    if (bucket) bucket.push(module);
  }

  return pergolas
    .map((pergola) => ({
      id: pergola.id,
      label: pergola.label,
      modules: byPergola.get(pergola.id) ?? [],
    }))
    .filter((pergola) => pergola.modules.length > 0);
}

export function buildPergolaDescription(params: {
  label?: unknown;
  fallbackIndex: number;
  modules: CalculatorModuleInputs[];
  projectDelivery?: string;
}): string {
  const lines: string[] = [];
  const pergolaLabel = normalizePergolaLabel(params.label, params.fallbackIndex);
  const styles = uniqueModuleStyles(params.modules);
  lines.push(pergolaLabel);

  if (!params.modules.length) {
    lines.push('- Included: Pergola works');
    lines.push('- Scope note: Final dimensions and selections require confirmation');
    return lines.join('\n');
  }

  appendFieldLine(lines, 'Included', PERGOLA_INCLUDED_SCOPE);
  appendFieldLine(lines, 'Project delivery', params.projectDelivery ?? null);

  if (params.modules.length === 1) {
    const module = params.modules[0]!;
    appendFieldLine(lines, 'Roof form', formatModuleStyle(module));
    appendFieldLine(lines, 'Overall size', formatModuleSize(module));
    appendFieldLine(lines, 'Roof covering', formatCustomerRoof(module));
    appendFieldLine(lines, 'Frame finish', formatModuleColour(module));
    appendFieldLine(lines, 'Roof pitch', formatModulePitch(module));
    appendFieldLine(lines, 'Support posts', formatModulePosts(module));
    appendFieldLine(lines, 'Connection to home', formatConnectionValue(module.houseConnectionType));
    appendFieldLine(lines, 'Post foundations and fixings', formatConnectionValue(module.postConnectionType));
    appendIncludedInfills(lines, module);
    return lines.join('\n');
  }

  const configurationLabel = styles.length === 1
    ? `${params.modules.length} connected ${styles[0]} roof sections`
    : `${joinStyleLabels(styles)} roof sections`;
  appendFieldLine(lines, 'Configuration', configurationLabel);

  const sharedFieldKeys = new Set<ModuleField['key']>();
  const sharedFields: Array<{ label: string; value: string }> = [];
  const sharedFieldMeta: Array<Pick<ModuleField, 'key' | 'label'>> = [
    { key: 'roof', label: 'Roof covering' },
    { key: 'colour', label: 'Frame finish' },
    { key: 'houseConnection', label: 'Connection to home' },
    { key: 'postFixings', label: 'Post foundations and fixings' },
  ];

  sharedFieldMeta.forEach(({ key, label }) => {
    const values = params.modules.map((module) => buildSharedCandidateFields(module).find((field) => field.key === key)?.value ?? null);
    if (values.some((value) => !value)) return;
    const normalized = values.map((value) => normalizeComparisonValue(value));
    if (!normalized.length || normalized.some((value) => !value || value !== normalized[0])) return;
    sharedFieldKeys.add(key);
    sharedFields.push({ label, value: values[0]! });
  });

  if (sharedFields.length) {
    lines.push('');
    lines.push('Shared across all roof sections');
    sharedFields.forEach((field) => appendFieldLine(lines, field.label, field.value));
  }

  params.modules.forEach((module, moduleIndex) => {
    lines.push('');
    const styleLabel = formatModuleStyle(module);
    lines.push(styleLabel ? `Roof section ${moduleIndex + 1}: ${styleLabel}` : `Roof section ${moduleIndex + 1}`);
    appendFieldLine(lines, 'Overall size', formatModuleSize(module));
    appendFieldLine(lines, 'Roof pitch', formatModulePitch(module));
    appendFieldLine(lines, 'Support posts', formatModulePosts(module));

    buildSharedCandidateFields(module)
      .filter((field) => !sharedFieldKeys.has(field.key))
      .forEach((field) => appendFieldLine(lines, field.label, field.value));
    appendIncludedInfills(lines, module);
  });

  return lines.join('\n');
}

type SiteCostCopyParams = {
  pergolaCount: number;
  sharedInstallCostEx?: number;
  travelCostEx?: number;
  extrasCostEx?: number;
};

function siteCostComponents(params: SiteCostCopyParams): {
  hasSharedInstall: boolean;
  hasTravel: boolean;
  hasExtras: boolean;
} {
  return {
    hasSharedInstall: Number.isFinite(params.sharedInstallCostEx) && Number(params.sharedInstallCostEx) > 0,
    hasTravel: Number.isFinite(params.travelCostEx) && Number(params.travelCostEx) > 0,
    hasExtras: Number.isFinite(params.extrasCostEx) && Number(params.extrasCostEx) > 0,
  };
}

function joinNaturalLanguage(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function buildIncludedSiteCostsValue(params: SiteCostCopyParams): string {
  const components = siteCostComponents(params);
  const included = [
    ...(components.hasSharedInstall ? ['installation setup'] : []),
    ...(components.hasTravel ? ['project travel'] : []),
    ...(components.hasExtras ? ['a project-specific site allowance'] : []),
  ];
  if (!included.length) return 'Project-specific setup and site costs included in this item';
  return `${joinNaturalLanguage(included)} included in this item`;
}

export function buildSiteCostsDescription(params: SiteCostCopyParams): string {
  const components = siteCostComponents(params);
  const heading = components.hasSharedInstall
    ? 'Project delivery and site setup'
    : components.hasTravel || components.hasExtras
      ? 'Project travel and site allowance'
      : 'Project delivery and site costs';
  const lines = [heading];

  if (components.hasSharedInstall) {
    lines.push(params.pergolaCount > 1
      ? `- Shared installation setup across ${params.pergolaCount} pergolas`
      : '- Installation setup for this project');
  }
  if (components.hasTravel) lines.push('- Travel to and from the project site');
  if (components.hasExtras) lines.push('- Project-specific site allowance');
  if (lines.length === 1) lines.push('- Project-specific delivery, setup and site costs');

  return lines.join('\n');
}

export function buildLegacyPergolaDescription(modules: CalculatorModuleInputs[]): string {
  return buildPergolaDescription({
    label: 'Pergola works',
    fallbackIndex: 0,
    modules,
  });
}
