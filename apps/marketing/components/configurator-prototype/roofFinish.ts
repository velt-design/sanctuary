import { DEFAULT_ROOF_FINISH, roofFinishBayLimit, representativeBoxRoofMaxProjection, type RepresentativeRoofFinish } from '@sp/geometry';
import type { PreviewRoofChoices } from './GableChoices';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { SIMPLE_COVER_PROJECTION_MAX_MM } from '../../lib/simpleCoverCalculator';

export function previewProjectionMax(roof: PreviewRoofChoices) {
  const finish = getRoofFinish(roof);
  return roof.family === 'box' && finish.material !== 'acrylic'
    ? Math.min(SIMPLE_COVER_PROJECTION_MAX_MM, representativeBoxRoofMaxProjection(finish)) : SIMPLE_COVER_PROJECTION_MAX_MM;
}

export const getRoofFinish = (roof: PreviewRoofChoices) => roof.finish ?? DEFAULT_ROOF_FINISH;
export const hasSimpleRoofPrice = (roof: PreviewRoofChoices) => roof.family === 'mono' && getRoofFinish(roof).material === 'acrylic' && !roof.blinds?.length && !roof.sidePanels?.length;
export const allowsHouseBand = (roof: PreviewRoofChoices) => roof.family === 'gable' && roof.orientation === 'away';
export function constrainRoofFinish(roof: PreviewRoofChoices, input: SimpleCoverInput): PreviewRoofChoices {
  if (!roof.finish) return roof;
  const finish = { ...roof.finish, layout: allowsHouseBand(roof) ? roof.finish.layout : 'central' as const };
  finish.acrylicBays = Math.min(finish.acrylicBays, roofFinishBayLimit(input.widthMm, input.projectionMm, roof.family, roof.orientation));
  return { ...roof, finish };
}
export function parseRoofFinish(value: unknown): RepresentativeRoofFinish | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const f = value as Record<string, unknown>;
  if (typeof f.material !== 'string' || typeof f.layout !== 'string' || typeof f.profile !== 'string') return null;
  if (!['acrylic', 'solid', 'combination'].includes(String(f.material)) || !['central', 'house'].includes(String(f.layout))
    || !['corrugated', 'trapezoidal', 'tray'].includes(String(f.profile)) || ![300, 400, 500].includes(f.trayWidth as number)
    || typeof f.acrylicBays !== 'number' || !Number.isInteger(f.acrylicBays) || f.acrylicBays < 1 || f.acrylicBays > 16) return null;
  return { material: f.material as RepresentativeRoofFinish['material'], layout: f.layout as RepresentativeRoofFinish['layout'],
    profile: f.profile as RepresentativeRoofFinish['profile'], acrylicBays: f.acrylicBays, trayWidth: f.trayWidth as RepresentativeRoofFinish['trayWidth'] };
}
export function roofFinishDescription(roof: PreviewRoofChoices) {
  const f = getRoofFinish(roof);
  if (f.material === 'acrylic') return 'Acrylic roof';
  return `${f.profile === 'tray' ? `Tray ${f.trayWidth} mm` : f.profile === 'trapezoidal' ? 'Trapezoidal' : 'Corrugated'} Colorsteel · Cedar ceiling`
    + (f.material === 'combination' ? ` · ${f.layout === 'central' ? 'Central' : 'House-side'} skylight · ${f.acrylicBays} acrylic ${f.acrylicBays === 1 ? 'bay' : 'bays'}` : '');
}
