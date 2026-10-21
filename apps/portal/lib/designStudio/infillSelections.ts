import type { InfillTakeoffInputV1 } from '@sp/costing';
import { resolveMonoSlopeShape } from '@/lib/infills/monoSlopeShape';
import { isStudioObject, type StudioJsonObject } from './contracts';

function fields(value: unknown, keys: readonly string[]): StudioJsonObject {
  if (!isStudioObject(value) || Object.keys(value).some(key => !keys.includes(key))) throw Error('Unsupported infill fields.');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw Error('Invalid infill text.');
  return value;
}
function number(value: unknown, zero = false): number {
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw Error('Enter an infill dimension or quantity.');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (zero ? parsed < 0 : parsed <= 0) || parsed > Number.MAX_SAFE_INTEGER / 1e6) throw Error('Invalid infill dimension or quantity.');
  return parsed;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw Error('Select an infill option.');
  return value as T;
}

/** Saved authoring -> requested takeoff. Auto remains Auto for the takeoff owner;
 * no estimated roof spacing, quantity rounding, width clamping or source switch.
 * Preserved legacy width controls are passed through to their existing owner.
 * Inactive retained values are returned explicitly rather than silently erased. */
export function resolveStudioInfillSelections(value: unknown): { infills: InfillTakeoffInputV1[]; inactiveFields: string[] } {
  if (value === undefined) return { infills: [], inactiveFields: [] };
  const container = fields(value, ['items']);
  if (!Array.isArray(container.items) || container.items.length > 512) throw Error('Invalid infill collection.');
  const ids = new Set<string>(), inactiveFields: string[] = [];
  const infills = container.items.map(raw => {
    const row = fields(raw, ['id', 'label', 'qty', 'location', 'acrylicSource', 'panelOrientation', 'support', 'shape', 'widthMode', 'targetPanelWidthM', 'maxPanelWidthM']);
    const id = text(row.id);
    if (!id || id.trim() !== id || ids.has(id)) throw Error('Unique infill identities required.');
    ids.add(id);
    const qty = number(row.qty);
    if (!Number.isSafeInteger(qty)) throw Error('Whole infill quantities required.');
    const support = fields(row.support, ['edgeConfirmations', 'internalSupportMode', 'internalSupportPositionsM', 'hasTop', 'hasBottom', 'hasLeft', 'hasRight']);
    const edges = fields(support.edgeConfirmations, ['top', 'bottom', 'left', 'right']);
    const has = (edge: string) => choice(edges[edge], ['yes', 'no', 'unsure']) === 'yes';
    const mode = choice(support.internalSupportMode, ['none', 'match_roof_rafters', 'center', 'custom']);
    const positions = support.internalSupportPositionsM;
    if (!Array.isArray(positions) || positions.some(position => typeof position !== 'string')) throw Error('Invalid infill support positions.');
    if (mode === 'custom' && !positions.length) throw Error('Enter custom infill support positions.');
    if (mode !== 'custom' && positions.length) inactiveFields.push(`${id}.support.internalSupportPositionsM`);
    for (const key of ['hasTop', 'hasBottom', 'hasLeft', 'hasRight']) if (support[key] !== undefined) {
      if (typeof support[key] !== 'boolean') throw Error('Invalid retained infill support.');
      inactiveFields.push(`${id}.support.${key}`);
    }
    const shape = fields(row.shape, isStudioObject(row.shape) && row.shape.type === 'rect'
      ? ['type', 'widthM', 'heightM', 'bottomOffsetM']
      : ['type', 'widthM', 'heightLowM', 'heightHighM', 'bottomOffsetM', 'slopeMode', 'slopeDeg', 'slopeAnchor']);
    const width_m = number(shape.widthM);
    const bottom_offset_m = shape.bottomOffsetM === undefined || shape.bottomOffsetM === '' ? undefined : number(shape.bottomOffsetM, true);
    let parsedShape: InfillTakeoffInputV1['shape'];
    if (shape.type === 'rect') parsedShape = { type: 'rect', width_m, height_m: number(shape.heightM), bottom_offset_m };
    else {
      if (shape.type !== 'mono_slope') throw Error('Unsupported infill shape.');
      const slopeMode = choice(shape.slopeMode, ['heights', 'pitch']);
      const slopeAnchor = choice(shape.slopeAnchor, ['left', 'right']);
      if (slopeMode === 'heights') {
        number(shape.heightLowM, true); number(shape.heightHighM, true);
        if (shape.slopeDeg !== undefined) inactiveFields.push(`${id}.shape.slopeDeg`);
      } else {
        number(slopeAnchor === 'left' ? shape.heightLowM : shape.heightHighM, true);
        if (number(shape.slopeDeg, true) >= 90) throw Error('Infill pitch must be below 90 degrees.');
        inactiveFields.push(`${id}.shape.${slopeAnchor === 'left' ? 'heightHighM' : 'heightLowM'}`);
      }
      const resolved = resolveMonoSlopeShape({ widthM: text(shape.widthM), heightLowM: text(shape.heightLowM), heightHighM: text(shape.heightHighM),
        slopeMode, slopeAnchor, slopeDeg: shape.slopeDeg === undefined ? undefined : text(shape.slopeDeg) });
      if (!Number.isFinite(resolved.leftHeightM) || !Number.isFinite(resolved.rightHeightM) || Math.max(resolved.leftHeightM, resolved.rightHeightM) <= 0) throw Error('Enter a positive infill opening height.');
      parsedShape = { type: 'mono_slope', width_m, height_low_m: resolved.leftHeightM, height_high_m: resolved.rightHeightM, bottom_offset_m };
    }
    // The current takeoff owns maximum width; target width is a retained legacy
    // field without an active role in that owner, recorded as inactive explicitly.
    if (row.targetPanelWidthM !== undefined) { text(row.targetPanelWidthM); inactiveFields.push(`${id}.targetPanelWidthM`); }
    return { id, ...(row.label === undefined ? {} : { label: text(row.label) }), qty,
      location: choice(row.location, ['front', 'house', 'side', 'gable_end', 'wall', 'custom']),
      acrylic_source: choice(row.acrylicSource, ['strip_620', 'sheet_panels', 'auto']),
      panel_orientation: choice(row.panelOrientation, ['vertical', 'horizontal', 'auto']),
      width_mode: row.widthMode === undefined ? 'target_width' as const : choice(row.widthMode, ['target_width', 'match_roof_rafters']),
      ...(row.maxPanelWidthM === undefined || row.maxPanelWidthM === '' ? {} : { max_panel_width_m: number(row.maxPanelWidthM) }),
      support: { has_top: has('top'), has_bottom: has('bottom'), has_left: has('left'), has_right: has('right'), internal_support_mode: mode,
        internal_support_positions_m: mode === 'custom' ? positions.map(position => number(position)) : [] }, shape: parsedShape };
  });
  return { infills, inactiveFields };
}
