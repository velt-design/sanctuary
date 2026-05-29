import {
  buildHouseReferenceProjectionShape,
  type GeometryTopProjectionShape,
  type HouseModel3D,
  type HouseReferenceGeometry,
} from '@sp/geometry';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import { buildHouseFormReferenceGeometry } from './buildHouseFormReferenceGeometry';

export type ProjectHouseGeometryEntry = {
  houseFormId: string;
  geometry: HouseReferenceGeometry;
  model: HouseModel3D;
  referenceShape: GeometryTopProjectionShape;
};

export function buildProjectHouseGeometryRegistry(
  projectModel: WorkbenchProjectModel | null | undefined,
): ProjectHouseGeometryEntry[] {
  const houseForms = projectModel?.houseAssembly?.houseForms ?? [];
  const seenHouseFormIds = new Set<string>();
  const entries: ProjectHouseGeometryEntry[] = [];
  for (const form of houseForms) {
    if (seenHouseFormIds.has(form.id)) continue;
    const geometry = buildHouseFormReferenceGeometry({ houseForm: form });
    if (!geometry?.model) continue;
    const referenceShape = buildHouseReferenceProjectionShape({
      house: geometry,
      houseSourceId: form.id,
    });
    if (!referenceShape) continue;
    seenHouseFormIds.add(form.id);
    entries.push({
      houseFormId: form.id,
      geometry,
      model: geometry.model,
      referenceShape,
    });
  }
  return entries;
}
