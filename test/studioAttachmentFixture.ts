import { EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT } from "../apps/portal/lib/drawings/state/objectFirstWorkbenchModel";
import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "../apps/portal/lib/designStudio/authoringView";
import { applyStudioHouseEdit } from "../apps/portal/lib/designStudio/houseEditing";
import { studioHouseScene } from "../apps/portal/lib/designStudio/studioHouseScene";
import { updateStudioHouse } from "../apps/portal/lib/designStudio/studioHouseCommands";
import { addWebsitePergola } from "../apps/portal/lib/designStudio/websiteComposition";
export function studioAttachmentFixture(
  rotation = 0,
  form: "flat" | "mono" | "hipped" = "flat",
) {
  let edit: StudioAuthoringEdit = {
    schemaVersion: "studio_authoring_edit.v1",
    designId: "attachment-physical-proof",
    revision: 1,
    spatial: structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),
    site: {},
    objectOptions: [],
    deletions: [],
  };
  const added = applyStudioHouseEdit(edit.spatial, {
    kind: "add",
    id: "house",
  });
  if (!added.ok) throw Error(added.message);
  edit.spatial = added.spatial;
  const house = studioHouseScene(edit.site, edit.spatial)!.houses[0];
  edit = updateStudioHouse(edit, {
    ...house,
    widthMm: "9500",
    depthMm: "8500",
    wallHeightMm: "3400",
    eaveHeightMm: "3400",
    roof: {
      ...house.roof,
      form,
      pitchDeg: form === "flat" ? "0" : "5",
      fasciaHeightMm: "350",
    },
    position: { xMm: "-2431.5", yMm: "782.75", rotationDeg: String(rotation) },
  });
  edit = addWebsitePergola(edit, "p2");
  const parsed = parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));
  if (!parsed.ok) throw Error(parsed.message);
  return parsed.value;
}
