import {
  type GeometryTopProjectionShape,
  type HouseModel3D,
  type HouseReferenceGeometry,
  type RawHouseInput,
} from '@sp/geometry';
import type { WorkbenchProjectModel } from './objectFirstWorkbenchModel';
import {
  buildHouseFormGeometryInput,
  type HouseFormGeometryInputDiagnostics,
} from './houseFormGeometryInput';

export type ProjectHouseGeometryEntry = {
  houseFormId: string;
  rawHouseInput: RawHouseInput;
  geometry: HouseReferenceGeometry;
  model: HouseModel3D;
  referenceShape: GeometryTopProjectionShape;
  geometryInputDiagnostics: HouseFormGeometryInputDiagnostics;
};

export function buildProjectHouseGeometryRegistry(
  projectModel: WorkbenchProjectModel | null | undefined,
): ProjectHouseGeometryEntry[] {
  const houseForms = projectModel?.houseAssembly?.houseForms ?? [];
  const seenHouseFormIds = new Set<string>();
  const entries: ProjectHouseGeometryEntry[] = [];
  for (const form of houseForms) {
    if (seenHouseFormIds.has(form.id)) continue;
    const geometryInput = buildHouseFormGeometryInput({
      projectModel: projectModel!,
      houseFormId: form.id,
    });
    if (!geometryInput.ok) continue;
    seenHouseFormIds.add(form.id);
    entries.push({
      houseFormId: form.id,
      rawHouseInput: geometryInput.rawHouseInput,
      geometry: geometryInput.geometry,
      model: geometryInput.model,
      referenceShape: geometryInput.referenceShape,
      geometryInputDiagnostics: geometryInput.diagnostics,
    });
  }
  return entries;
}
