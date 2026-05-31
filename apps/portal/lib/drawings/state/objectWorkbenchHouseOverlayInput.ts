import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { WorkbenchObjectRef, HouseFormModel } from './objectFirstWorkbenchModel';
import type { ProjectHouseGeometryEntry } from './projectHouseGeometryRegistry';

export type ObjectWorkbenchHouseOverlayInputResolution = {
  houseForm: HouseFormModel | null;
  houseReferenceShape: GeometryTopProjectionShape | null;
};

export function resolveObjectWorkbenchHouseOverlayInput(input: {
  activeObjectRef: WorkbenchObjectRef;
  houseForms: ReadonlyArray<HouseFormModel>;
  projectHouseGeometries: ReadonlyArray<ProjectHouseGeometryEntry>;
}): ObjectWorkbenchHouseOverlayInputResolution {
  if (input.activeObjectRef.family !== 'house_forms' || !input.activeObjectRef.objectId) {
    return { houseForm: null, houseReferenceShape: null };
  }

  const houseForm =
    input.houseForms.find((candidate) => candidate.id === input.activeObjectRef.objectId) ??
    null;
  if (!houseForm) {
    return { houseForm: null, houseReferenceShape: null };
  }

  return {
    houseForm,
    houseReferenceShape:
      input.projectHouseGeometries.find((entry) => entry.houseFormId === houseForm.id)?.referenceShape ??
      null,
  };
}
