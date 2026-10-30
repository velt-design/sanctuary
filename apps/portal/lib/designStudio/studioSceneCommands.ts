import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "./authoringView";
import { applyStudioHouseEdit } from "./houseEditing";
import { applyStudioPergolaEdit } from "./pergolaEditing";
import { duplicateCollections } from "./pergolaDuplication";
import { isStudioObject, type StudioJsonObject } from "./contracts";
import {
  parseWebsiteAttachments,
  studioHouseScene,
  type StudioHouseAttachment,
} from "./studioHouseScene";
import {
  positionWebsitePergola,
  websiteComposition,
  websitePosition,
} from "./websiteComposition";
import {
  previewStudioAttachment,
  studioAttachmentCanonicalEdge,
  updateStudioHouse,
} from "./studioHouseCommands";
import { houseNumber, studioHouseTargets } from "./studioHouseGeometry";

type CopyContext = Parameters<typeof applyStudioPergolaEdit>[2];
export type StudioSceneCopy = {
  kind: "house" | "pergola";
  id: string;
  edit: StudioAuthoringEdit;
};
const checked = (edit: StudioAuthoringEdit) => {
  const result = parseStudioAuthoringEdit(edit);
  if (!result.ok) throw Error(result.message);
  return result.value;
};
export function copyStudioSceneObject(
  edit: StudioAuthoringEdit,
  id: string,
): StudioSceneCopy {
  const snapshot = checked(edit);
  if (snapshot.spatial.houseAssembly?.houseForms.some((h) => h.id === id))
    return { kind: "house", id, edit: snapshot };
  if (snapshot.spatial.pergolas.some((p) => p.id === id))
    return { kind: "pergola", id, edit: snapshot };
  throw Error("Select a current house or pergola to copy.");
}
/** Duplicate the frozen safe selection, then merge only the new identity into
 * CURRENT work. No clipboard snapshot can overwrite later site or peer edits. */
export function pasteStudioSceneObject(
  current: StudioAuthoringEdit,
  copy: StudioSceneCopy,
  id: string,
  context: CopyContext,
) {
  if (context.savePending)
    throw Error("Finish saving before making another copy.");
  const next = checked(current);
  if (copy.edit.designId !== next.designId)
    throw Error("This copy belongs to another design.");
  if (copy.kind === "house") {
    const result = applyStudioHouseEdit(copy.edit.spatial, {
      kind: "duplicate",
      houseFormId: copy.id,
      id,
    });
    if (!result.ok) throw Error(result.message);
    const form = result.spatial.houseAssembly!.houseForms.find(
      (h) => h.id === id,
    )!;
    const assembly = next.spatial.houseAssembly ?? {
      ...result.spatial.houseAssembly!,
      houseForms: [],
    };
    next.spatial.houseAssembly = {
      ...assembly,
      houseForms: [...assembly.houseForms, form],
    };
  } else {
    const rowIds = {
      flashings: {} as Record<string, string>,
      infills: {} as Record<string, string>,
    };
    const values =
      copy.edit.objectOptions.find((r) => r.objectId === copy.id)?.values ?? {};
    for (const [section, collection] of duplicateCollections) {
      const container = values[section];
      if (isStudioObject(container) && Array.isArray(container[collection]))
        for (const row of container[collection])
          if (isStudioObject(row) && typeof row.id === "string")
            rowIds[section][row.id] = crypto.randomUUID();
    }
    const source = structuredClone(copy.edit);
    // A once-unsaved copied source may since have been acknowledged or removed.
    // Existing duplication must use only the CURRENT baseline's private ancestry.
    if (source.duplications)
      source.duplications = source.duplications.filter(
        (op) =>
          op.targetId !== copy.id ||
          (!context.persistedObjectIds.includes(copy.id) &&
            !!op.sourceId &&
            context.persistedObjectIds.includes(op.sourceId)),
      );
    const result = applyStudioPergolaEdit(
      source,
      { kind: "duplicate", pergolaId: copy.id, id, rowIds },
      context,
    );
    if (!result.ok) throw Error(result.message);
    next.schemaVersion = "studio_authoring_edit.v2";
    next.spatial.pergolas.push(
      result.edit.spatial.pergolas.find((p) => p.id === id)!,
    );
    next.objectOptions.push(
      result.edit.objectOptions.find((r) => r.objectId === id)!,
    );
    next.duplications = [
      ...(next.duplications ?? []),
      ...result.edit.duplications!.filter((op) => op.targetId === id),
    ];
    const binding =
      result.edit.site.websiteAttachments &&
      parseWebsiteAttachments(
        result.edit.site.websiteAttachments,
      ).attachments.find((a) => a.objectId === id);
    if (binding) {
      if (
        !next.spatial.houseAssembly?.houseForms.some(
          (h) => h.id === binding.houseId,
        )
      )
        throw Error("The copied connection's house is no longer available.");
      const attachments = next.site.websiteAttachments
        ? parseWebsiteAttachments(next.site.websiteAttachments).attachments
        : [];
      next.site.websiteAttachments = {
        schemaVersion: "website_attachments.v1",
        attachments: [...attachments, binding],
      } as unknown as StudioJsonObject;
    }
    const host = next.spatial.pergolas.at(-1)?.attachment?.host;
    if (
      host &&
      !next.spatial.houseAssembly?.houseForms.some(
        (h) => h.id === host.objectId,
      ) &&
      !next.spatial.pergolas.some((p) => p.id === host.objectId)
    )
      throw Error("The copied object's host is no longer available.");
  }
  return checked(next);
}
export function removeStudioSceneObject(
  current: StudioAuthoringEdit,
  id: string,
  context: CopyContext,
) {
  if (current.spatial.houseAssembly?.houseForms.some((h) => h.id === id)) {
    if (
      current.site.websiteAttachments &&
      parseWebsiteAttachments(current.site.websiteAttachments).attachments.some(
        (a) => a.houseId === id,
      )
    )
      throw Error("Detach the house references before removing this house.");
    const result = applyStudioHouseEdit(current.spatial, {
      kind: "remove",
      houseFormId: id,
    });
    if (!result.ok) throw Error(result.message);
    return checked({ ...current, spatial: result.spatial });
  }
  const result = applyStudioPergolaEdit(
    current,
    { kind: "remove", pergolaId: id },
    context,
  );
  if (!result.ok) throw Error(result.message);
  return result.edit;
}
export function nudgeStudioSceneObject(
  current: StudioAuthoringEdit,
  id: string,
  dx: number,
  dy: number,
): { edit: StudioAuthoringEdit; notice?: string } {
  if (!Number.isFinite(dx) || !Number.isFinite(dy))
    throw Error("Enter a finite movement.");
  if (current.spatial.houseAssembly?.houseForms.some((h) => h.id === id)) {
    const house = studioHouseScene(current.site, current.spatial)?.houses.find(
      (h) => h.id === id,
    );
    if (!house) throw Error("The selected house is unavailable.");
    return {
      edit: updateStudioHouse(current, {
        ...house,
        position: {
          ...house.position,
          xMm: String(houseNumber(house.position.xMm, "house X") + dx),
          yMm: String(houseNumber(house.position.yMm, "house Y") + dy),
        },
      }),
    };
  }
  const object = current.spatial.pergolas.find((p) => p.id === id);
  if (!object) throw Error("The selected pergola is no longer available.");
  const companion =
    current.site.websiteAttachments &&
    parseWebsiteAttachments(current.site.websiteAttachments).attachments.some(
      (a) => a.objectId === id,
    );
  if (!object.attachment?.host && !companion) {
    const position = websitePosition(object.position);
    if (!position)
      throw Error("Enter valid position values before moving this pergola.");
    return {
      edit: positionWebsitePergola(current, id, {
        originXMm: String(position.x + dx),
        originYMm: String(position.y + dy),
      }),
    };
  }
  const row = websiteComposition(current).find((p) => p.object.id === id);
  if (!row?.position || row.error)
    throw Error(row?.error ?? "The selected pergola cannot be moved.");
  if (row.studioAttachment || row.object.attachment?.host) {
    const scene = studioHouseScene(current.site, current.spatial),
      host = row.object.attachment?.host;
    const supplied = row.studioAttachment;
    let binding: Omit<StudioHouseAttachment, "reference"> | null = supplied
      ? {
          objectId: supplied.objectId,
          houseId: supplied.houseId,
          edge: supplied.edge,
          kind: supplied.kind,
          method: supplied.method,
          ...(supplied.alongEdgeMm !== undefined
            ? { alongEdgeMm: supplied.alongEdgeMm }
            : {}),
          contactBasis: "canonical-house.v1",
        }
      : null;
    if (!binding && host?.objectFamily === "house_forms" && scene) {
      const house = scene.houses.find((h) => h.id === host.objectId);
      const method: StudioHouseAttachment["method"] | null =
        row.object.attachment?.method === "facade_ledger"
          ? "facade"
          : row.object.attachment?.method === "fascia_under_gutter"
            ? "fascia"
            : row.object.attachment?.method === "direct_to_soffit"
              ? "soffit"
              : null;
      if (house && method)
        for (const target of studioHouseTargets(house, method).filter(
          (t) => t.kind === (method === "facade" ? "wall" : "eave"),
        )) {
          const choice = {
            objectId: id,
            houseId: house.id,
            edge: target.side,
            kind: target.kind,
            method,
            contactBasis: "canonical-house.v1" as const,
          };
          try {
            if (
              studioAttachmentCanonicalEdge(current.spatial, house, choice)
                .id === host.edgeId
            )
              binding = choice;
          } catch {
            /* Other real sides are not this host. */
          }
        }
    }
    if (!binding || !scene)
      throw Error(
        "Choose a supported house connection before sliding this retained attachment.",
      );
    if (!supplied) {
      const original = websiteComposition(
        previewStudioAttachment(current, binding),
      ).find((p) => p.object.id === id);
      const angle =
        (((original?.position?.rotation ?? 0) - row.position.rotation) *
          Math.PI) /
        180;
      if (
        !original?.position ||
        Math.hypot(
          original.position.x - row.position.x,
          original.position.y - row.position.y,
        ) > 1e-5 ||
        Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) > 1e-7 ||
        original.geometryOptions?.supportDatumMm !==
          row.geometryOptions?.supportDatumMm
      )
        throw Error(
          "Review this retained connection before sliding it. Its current pose and height are kept.",
        );
    }
    const house = scene.houses.find((h) => h.id === binding.houseId)!;
    const target = studioHouseTargets(house, binding.method).find(
      (t) => t.kind === binding!.kind && t.side === binding!.edge,
    );
    if (!target) throw Error("The connected house edge is unavailable.");
    let tx = target.end.x - target.start.x,
      ty = target.end.y - target.start.y;
    if (
      -ty * (target.centre.x - (target.start.x + target.end.x) / 2) +
        tx * (target.centre.y - (target.start.y + target.end.y) / 2) >
      0
    ) {
      tx = -tx;
      ty = -ty;
    }
    const projection = dx * tx + dy * ty;
    if (Math.abs(projection) <= Math.hypot(dx, dy) * Math.hypot(tx, ty) * 1e-10)
      throw Error(
        "That arrow points across the connection. Use an arrow along the house edge to slide; the pergola stays attached.",
      );
    const alongEdgeMm =
      (binding.alongEdgeMm ?? 0) + Math.sign(projection) * Math.hypot(dx, dy);
    return {
      edit: previewStudioAttachment(current, { ...binding, alongEdgeMm }),
      notice: "Moved along the house edge.",
    };
  }
  return {
    edit: positionWebsitePergola(current, id, {
      originXMm: String(row.position.x + dx),
      originYMm: String(row.position.y + dy),
    }),
  };
}
