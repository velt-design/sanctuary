import type { CalculatorModuleInputs } from '@/lib/types/calculator';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number.parseFloat(value);
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase())
    .trim();
}

export function formatDimension(value: string): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}`;
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function formatModuleStyle(module: CalculatorModuleInputs): string | null {
  const raw = typeof module?.pergolaStyle === 'string' ? module.pergolaStyle.trim() : '';
  return raw ? toTitleCase(raw) : null;
}

export function formatModuleRoof(module: CalculatorModuleInputs): string | null {
  const raw = typeof module?.roofMaterial === 'string' ? module.roofMaterial.trim() : '';
  if (raw === 'none') return 'No roof covering';
  return raw ? toTitleCase(raw) : null;
}

export function formatModuleColour(module: CalculatorModuleInputs): string | null {
  const base = typeof module?.extrusionColour === 'string' ? module.extrusionColour.trim() : '';
  if (!base) return null;
  if (module.powdercoatIsCustom) {
    const custom = typeof module?.powdercoatCustomColour === 'string' ? module.powdercoatCustomColour.trim() : '';
    return custom ? `${base} (${custom})` : `${base} (Custom)`;
  }
  const standard = typeof module?.powdercoatStandardColour === 'string' ? module.powdercoatStandardColour.trim() : '';
  return standard ? `${base} (${standard})` : base;
}

export function formatModuleSize(module: CalculatorModuleInputs): string {
  const length = formatDimension(module.lengthM);
  const projection = formatDimension(module.projectionM);
  if (module.pergolaStyle === 'hip_corner') {
    return `A ${length}m x ${projection}m, B ${formatDimension(module.hipCornerLengthBM)}m x ${formatDimension(module.hipCornerProjectionBM)}m`;
  }
  return `${length}m x ${projection}m`;
}

export function formatModulePitch(module: CalculatorModuleInputs): string | null {
  const raw = typeof module?.roofPitchDeg === 'string' ? module.roofPitchDeg.trim() : '';
  return raw ? `${raw}°` : null;
}

export function formatModulePosts(module: CalculatorModuleInputs): string | null {
  const raw = typeof module?.postCount === 'string' ? module.postCount.trim() : String(module?.postCount ?? '').trim();
  return raw || null;
}
