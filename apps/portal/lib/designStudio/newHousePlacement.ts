import type { ResolvedStudioScene } from './interaction/resolvedScene';
import { transformWebsitePoint } from './websiteComposition';
import { STUDIO_NEW_HOUSE_SIZE } from './houseEditing';

/** Place a new rectangle beside the occupied WORLD envelope. No existing object
 * moves, and rotated products retain their full physical footprint. */
export function newStudioHousePosition(scene: ResolvedStudioScene) {
  const points = [...scene.houses.flatMap(h => h.footprint), ...scene.products.flatMap(p => p.position && p.physical
    ? p.physical.points.map(point => transformWebsitePoint(point, p.position!)) : [])];
  if (!points.length) return { x: 0, y: 0 };
  // Product rear is -Y. Centre the house behind it with a clear1m gap.
  return { x: Math.round((Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x))-STUDIO_NEW_HOUSE_SIZE.widthMm)/2), y: Math.floor(Math.min(...points.map(p => p.y)) - STUDIO_NEW_HOUSE_SIZE.depthMm - 1000) };
}
