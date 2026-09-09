import type { Point3 } from './contracts';
import type { RepresentativeRoofProfile } from './representativeRoofProfiles';

export type RepresentativeRoofFinish = {
  material: 'acrylic' | 'solid' | 'combination';
  layout: 'central' | 'house'; acrylicBays: number;
  profile: RepresentativeRoofProfile; trayWidth: 300 | 400 | 500;
};
export const DEFAULT_ROOF_FINISH: RepresentativeRoofFinish = {
  material: 'acrylic', layout: 'central', acrylicBays: 2, profile: 'corrugated', trayWidth: 400,
};
export type RoofFinishMesh = { id: string; kind: 'steel' | 'cedar' | 'flashing'; positions: number[]; indices: number[]; grainAcross?: Point3; grainAlong?: Point3 };
export type RoofFinishRegion = { id: string; material: 'acrylic' | 'solid'; boundary: Point3[] };
export type RoofFinishGeometry = { meshes: RoofFinishMesh[]; regions: RoofFinishRegion[]; acrylicBays: number; maxAcrylicBays: number };

export function roofFinishBayLimit(widthMm: number, projectionMm: number, family: string, orientation: string) {
  const run = family === 'gable' && orientation === 'away' ? projectionMm : widthMm;
  return Math.max(1, Math.floor((run - 100) / 620) - 1);
}
