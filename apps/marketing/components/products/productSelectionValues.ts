export const PRODUCT_MATERIALS = [
  { value: 'acrylic', label: 'Acrylic', detail: 'Light through the whole roof.' },
  { value: 'solid', label: 'Solid + timber', detail: 'Corrugated Colorsteel with 150 mm ThermoPine lining.' },
  { value: 'combination', label: 'Mixed + timber', detail: 'A central acrylic skylight with ThermoPine-lined solid roof either side.' },
] as const;
export const PRODUCT_SIDES = [
  { value: 'open', label: 'Open sides' },
  { value: 'left', label: 'Left blind' },
  { value: 'right', label: 'Right blind' },
  { value: 'all', label: 'Front + both sides' },
] as const;
export type ProductSelection = {
  widthMm: number; projectionMm: number;
  material: typeof PRODUCT_MATERIALS[number]['value'];
  sides: typeof PRODUCT_SIDES[number]['value'];
  orientation?: 'parallel' | 'away';
};
export const INITIAL_PRODUCT_SELECTION: ProductSelection = { widthMm: 6000, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' };

export function parseProductSelection(value: unknown): ProductSelection | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as ProductSelection;
  if (![v.widthMm, v.projectionMm].every(n => Number.isInteger(n) && n >= 1500 && n % 100 === 0)
    || v.widthMm > 10000 || v.projectionMm > 6000
    || !PRODUCT_MATERIALS.some(m => m.value === v.material) || !PRODUCT_SIDES.some(s => s.value === v.sides)
    || (v.orientation !== undefined && !['parallel', 'away'].includes(v.orientation))) return null;
  return { widthMm: v.widthMm, projectionMm: v.projectionMm, material: v.material, sides: v.sides, orientation: v.orientation ?? 'parallel' };
}
