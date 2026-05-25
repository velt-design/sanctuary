import type {
  Assembly3D,
  AssemblyMemberEndCut,
  AssemblySupportCondition,
  GeometryMetadata,
  GeometryMetadataValue,
  HouseAttachmentTarget3D,
  HouseEaveGeometry3D,
  HouseModel3D,
  HouseRoofFeature3D,
  HouseWallSegment3D,
  Line3,
  Plane3,
  Point3,
  Polygon3,
  QuantityHook,
  RoofFlashing3D,
  RoofPlane3D,
  Vector3,
} from "../contracts";

export type CanonicalAssembly3D = Assembly3D;

export type CanonicalAssemblyDiffEntry = {
  path: string;
  expected: unknown;
  actual: unknown;
};

function roundMillimetre(value: number): number {
  return Math.round(value);
}

function roundUnit(value: number): number {
  return Number(value.toFixed(6));
}

function canonicalizeMetadataValue(
  value: GeometryMetadataValue,
): GeometryMetadataValue {
  if (typeof value === "number") {
    return roundUnit(value);
  }
  return value;
}

function canonicalizeMetadata(
  metadata: GeometryMetadata | undefined,
): GeometryMetadata | undefined {
  if (!metadata) return undefined;
  const next: GeometryMetadata = {};
  for (const key of Object.keys(metadata).sort()) {
    if (key.startsWith("roofQa")) continue;
    if (key.startsWith("roofTopology")) continue;
    if (key.startsWith("roofWavefront")) continue;
    if (key === "roofFacetMergeMode") continue;
    if (key.startsWith("roofFacet")) continue;
    if (key.startsWith("roofBase")) continue;
    if (key.startsWith("roofSplit")) continue;
    if (key.startsWith("roofAssigned")) continue;
    if (key.startsWith("roofAtomic")) continue;
    if (key.startsWith("roofDissolved")) continue;
    if (key.startsWith("roofDiscarded")) continue;
    if (key.startsWith("roofPreserved")) continue;
    if (key.startsWith("roofRejected")) continue;
    if (key.startsWith("roofFallback")) continue;
    next[key] = canonicalizeMetadataValue(metadata[key]!);
  }
  return Object.keys(next).length ? next : undefined;
}

function canonicalizePolygon2(
  points: Array<{ x: number; y: number }> | null | undefined,
) {
  return (
    points?.map((point) => ({
      x: roundMillimetre(point.x),
      y: roundMillimetre(point.y),
    })) ?? null
  );
}

function canonicalizePoint3(point: Point3): Point3 {
  return {
    x: roundMillimetre(point.x),
    y: roundMillimetre(point.y),
    z: roundMillimetre(point.z),
  };
}

function canonicalizeVector3(vector: Vector3): Vector3 {
  return {
    x: roundUnit(vector.x),
    y: roundUnit(vector.y),
    z: roundUnit(vector.z),
  };
}

function canonicalizeLine3(line: Line3): Line3 {
  return {
    start: canonicalizePoint3(line.start),
    end: canonicalizePoint3(line.end),
  };
}

function canonicalizeOptionalLine3(
  line: Line3 | null | undefined,
): Line3 | null {
  return line ? canonicalizeLine3(line) : null;
}

function canonicalizePolygon3(
  points: Polygon3 | null | undefined,
): Polygon3 | null {
  return points?.map(canonicalizePoint3) ?? null;
}

function canonicalizePlane3(plane: Plane3): Plane3 {
  return {
    origin: canonicalizePoint3(plane.origin),
    xAxis: canonicalizeVector3(plane.xAxis),
    yAxis: canonicalizeVector3(plane.yAxis),
    normal: canonicalizeVector3(plane.normal),
  };
}

function canonicalizeOptionalPlane3(
  plane: Plane3 | null | undefined,
): Plane3 | null {
  return plane ? canonicalizePlane3(plane) : null;
}

function canonicalizeRoofPlane3D(roofPlane: RoofPlane3D): RoofPlane3D {
  return {
    ...roofPlane,
    boundary: roofPlane.boundary.map(canonicalizePoint3),
    plane: canonicalizePlane3(roofPlane.plane),
    fallVector: canonicalizeVector3(roofPlane.fallVector),
    metadata: canonicalizeMetadata(roofPlane.metadata),
  };
}

function canonicalizeHouseWallSegment(
  segment: HouseWallSegment3D,
): HouseWallSegment3D {
  return {
    id: segment.id,
    line: canonicalizeLine3(segment.line),
    plane: canonicalizePlane3(segment.plane),
    boundary: segment.boundary.map(canonicalizePoint3),
    sourceEdgeId: segment.sourceEdgeId ?? null,
    metadata: canonicalizeMetadata(segment.metadata),
  };
}

function canonicalizeHouseEaveGeometry(
  eave: HouseEaveGeometry3D,
): HouseEaveGeometry3D {
  return {
    soffitDepthMm:
      typeof eave.soffitDepthMm === "number"
        ? roundMillimetre(eave.soffitDepthMm)
        : (eave.soffitDepthMm ?? null),
    fasciaHeightMm:
      typeof eave.fasciaHeightMm === "number"
        ? roundMillimetre(eave.fasciaHeightMm)
        : (eave.fasciaHeightMm ?? null),
    gutterWidthMm:
      typeof eave.gutterWidthMm === "number"
        ? roundMillimetre(eave.gutterWidthMm)
        : (eave.gutterWidthMm ?? null),
    gutterDepthMm:
      typeof eave.gutterDepthMm === "number"
        ? roundMillimetre(eave.gutterDepthMm)
        : (eave.gutterDepthMm ?? null),
    gutterProjectionMm:
      typeof eave.gutterProjectionMm === "number"
        ? roundMillimetre(eave.gutterProjectionMm)
        : (eave.gutterProjectionMm ?? null),
    eaveOverhangMm:
      typeof eave.eaveOverhangMm === "number"
        ? roundMillimetre(eave.eaveOverhangMm)
        : (eave.eaveOverhangMm ?? null),
    soffitPolygons: eave.soffitPolygons?.map((polygon) =>
      polygon.map(canonicalizePoint3),
    ) ?? null,
    fasciaPolygons: eave.fasciaPolygons?.map((polygon) =>
      polygon.map(canonicalizePoint3),
    ) ?? null,
    gutterLines: eave.gutterLines?.map(canonicalizeLine3) ?? null,
    gutterBoundaries: eave.gutterBoundaries?.map((polygon) =>
      polygon.map(canonicalizePoint3),
    ) ?? null,
    metadata: canonicalizeMetadata(eave.metadata),
  };
}

function canonicalizeHouseRoofFeature(
  feature: HouseRoofFeature3D,
): HouseRoofFeature3D {
  return {
    id: feature.id,
    kind: feature.kind,
    line: canonicalizeLine3(feature.line),
    metadata: canonicalizeMetadata(feature.metadata),
  };
}

function canonicalizeHouseAttachmentTarget(
  target: HouseAttachmentTarget3D | null | undefined,
): HouseAttachmentTarget3D | null {
  if (!target) return null;
  return {
    kind: target.kind,
    strategy: target.strategy,
    line: canonicalizeOptionalLine3(target.line),
    plane: canonicalizeOptionalPlane3(target.plane),
    zone: target.zone
      ? {
          plane: canonicalizePlane3(target.zone.plane),
          topZMm:
            typeof target.zone.topZMm === "number"
              ? roundMillimetre(target.zone.topZMm)
              : (target.zone.topZMm ?? null),
          bottomZMm:
            typeof target.zone.bottomZMm === "number"
              ? roundMillimetre(target.zone.bottomZMm)
              : (target.zone.bottomZMm ?? null),
          boundary: canonicalizePolygon3(target.zone.boundary),
          safeLine: canonicalizeOptionalLine3(target.zone.safeLine),
          metadata: canonicalizeMetadata(target.zone.metadata),
        }
      : null,
    sourceEdgeId: target.sourceEdgeId ?? null,
    metadata: canonicalizeMetadata(target.metadata),
  };
}

function canonicalizeHouseModel(
  model: HouseModel3D | null | undefined,
): HouseModel3D | null {
  if (!model) return null;
  return {
    // `houseId` is normalized to a stable placeholder in the canonical form.
    // PR-Geo1 (2026-05-25): the field is identity (which house this is),
    // not geometric content (the shape of this house). Per the pattern
    // documented for `roofRidgeAxis` in contracts.ts, identity fields are
    // excluded from the golden-hash so renaming/repointing a house doesn't
    // drift the canonical assembly diff. Without this normalisation, every
    // golden fixture would break the moment a houseId differs from the
    // legacy 'host-house' default.
    houseId: 'canonical-house',
    footprint: model.footprint.map(canonicalizePoint3),
    wallSegments: [...model.wallSegments]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(canonicalizeHouseWallSegment),
    roofPlanes: [...model.roofPlanes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(canonicalizeRoofPlane3D),
    roofFeatures: [...(model.roofFeatures ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(canonicalizeHouseRoofFeature),
    ...(model.roofFlashings?.length
      ? {
          roofFlashings: [...model.roofFlashings]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(canonicalizeRoofFlashing),
        }
      : {}),
    eave: canonicalizeHouseEaveGeometry(model.eave),
    attachmentTarget: canonicalizeHouseAttachmentTarget(model.attachmentTarget),
    metadata: canonicalizeMetadata(model.metadata),
  };
}

function canonicalizeRoofFlashing(flashing: RoofFlashing3D): RoofFlashing3D {
  return {
    ...flashing,
    thicknessMm: roundMillimetre(flashing.thicknessMm),
    wings: [...flashing.wings]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((wing) => ({
        id: wing.id,
        boundary: wing.boundary.map((point) => ({
          x: roundMillimetre(point.x),
          y: roundMillimetre(point.y),
          z: roundMillimetre(point.z),
        })),
        plane: {
          origin: {
            x: roundMillimetre(wing.plane.origin.x),
            y: roundMillimetre(wing.plane.origin.y),
            z: roundMillimetre(wing.plane.origin.z),
          },
          xAxis: {
            x: roundUnit(wing.plane.xAxis.x),
            y: roundUnit(wing.plane.xAxis.y),
            z: roundUnit(wing.plane.xAxis.z),
          },
          yAxis: {
            x: roundUnit(wing.plane.yAxis.x),
            y: roundUnit(wing.plane.yAxis.y),
            z: roundUnit(wing.plane.yAxis.z),
          },
          normal: {
            x: roundUnit(wing.plane.normal.x),
            y: roundUnit(wing.plane.normal.y),
            z: roundUnit(wing.plane.normal.z),
          },
        },
      })),
    metadata: canonicalizeMetadata(flashing.metadata),
  };
}

function canonicalizeEndCuts(
  endCuts: AssemblyMemberEndCut[] | null | undefined,
): AssemblyMemberEndCut[] | undefined {
  if (!endCuts?.length) return undefined;
  return endCuts.map((cut) => ({
    end: cut.end,
    plane: {
      normal: {
        x: roundUnit(cut.plane.normal.x),
        y: roundUnit(cut.plane.normal.y),
        z: roundUnit(cut.plane.normal.z),
      },
      offsetMm: roundMillimetre(cut.plane.offsetMm),
      keepSide: cut.plane.keepSide,
    },
    preClipExtensionMm: roundMillimetre(cut.preClipExtensionMm),
  }));
}

export function canonicalizeAssembly3D(
  assembly: Assembly3D,
): CanonicalAssembly3D {
  return {
    family: assembly.family,
    datum: {
      origin: {
        x: roundMillimetre(assembly.datum.origin.x),
        y: roundMillimetre(assembly.datum.origin.y),
        z: roundMillimetre(assembly.datum.origin.z),
      },
      xAxis: {
        x: roundUnit(assembly.datum.xAxis.x),
        y: roundUnit(assembly.datum.xAxis.y),
        z: roundUnit(assembly.datum.xAxis.z),
      },
      yAxis: {
        x: roundUnit(assembly.datum.yAxis.x),
        y: roundUnit(assembly.datum.yAxis.y),
        z: roundUnit(assembly.datum.yAxis.z),
      },
      zAxis: {
        x: roundUnit(assembly.datum.zAxis.x),
        y: roundUnit(assembly.datum.zAxis.y),
        z: roundUnit(assembly.datum.zAxis.z),
      },
      attachmentEdgeStart: {
        x: roundMillimetre(assembly.datum.attachmentEdgeStart.x),
        y: roundMillimetre(assembly.datum.attachmentEdgeStart.y),
        z: roundMillimetre(assembly.datum.attachmentEdgeStart.z),
      },
      attachmentEdgeEnd: {
        x: roundMillimetre(assembly.datum.attachmentEdgeEnd.x),
        y: roundMillimetre(assembly.datum.attachmentEdgeEnd.y),
        z: roundMillimetre(assembly.datum.attachmentEdgeEnd.z),
      },
    },
    outline: assembly.outline.map((point) => ({
      x: roundMillimetre(point.x),
      y: roundMillimetre(point.y),
      z: roundMillimetre(point.z),
    })),
    attachmentEdge: assembly.attachmentEdge
      ? {
          start: {
            x: roundMillimetre(assembly.attachmentEdge.start.x),
            y: roundMillimetre(assembly.attachmentEdge.start.y),
            z: roundMillimetre(assembly.attachmentEdge.start.z),
          },
          end: {
            x: roundMillimetre(assembly.attachmentEdge.end.x),
            y: roundMillimetre(assembly.attachmentEdge.end.y),
            z: roundMillimetre(assembly.attachmentEdge.end.z),
          },
        }
      : null,
    house: {
      wallPlane: assembly.house.wallPlane
        ? {
            origin: {
              x: roundMillimetre(assembly.house.wallPlane.origin.x),
              y: roundMillimetre(assembly.house.wallPlane.origin.y),
              z: roundMillimetre(assembly.house.wallPlane.origin.z),
            },
            xAxis: {
              x: roundUnit(assembly.house.wallPlane.xAxis.x),
              y: roundUnit(assembly.house.wallPlane.xAxis.y),
              z: roundUnit(assembly.house.wallPlane.xAxis.z),
            },
            yAxis: {
              x: roundUnit(assembly.house.wallPlane.yAxis.x),
              y: roundUnit(assembly.house.wallPlane.yAxis.y),
              z: roundUnit(assembly.house.wallPlane.yAxis.z),
            },
            normal: {
              x: roundUnit(assembly.house.wallPlane.normal.x),
              y: roundUnit(assembly.house.wallPlane.normal.y),
              z: roundUnit(assembly.house.wallPlane.normal.z),
            },
          }
        : null,
      fasciaLine: canonicalizeOptionalLine3(assembly.house.fasciaLine),
      roofEdgeLine: canonicalizeOptionalLine3(assembly.house.roofEdgeLine),
      soffitDepthMm:
        typeof assembly.house.soffitDepthMm === "number"
          ? roundMillimetre(assembly.house.soffitDepthMm)
          : (assembly.house.soffitDepthMm ?? null),
      footprint: canonicalizePolygon3(assembly.house.footprint),
      model: canonicalizeHouseModel(assembly.house.model),
      attachmentTarget: canonicalizeHouseAttachmentTarget(
        assembly.house.attachmentTarget,
      ),
    },
    members: [...assembly.members]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((member) => ({
        ...member,
        centerline: {
          start: {
            x: roundMillimetre(member.centerline.start.x),
            y: roundMillimetre(member.centerline.start.y),
            z: roundMillimetre(member.centerline.start.z),
          },
          end: {
            x: roundMillimetre(member.centerline.end.x),
            y: roundMillimetre(member.centerline.end.y),
            z: roundMillimetre(member.centerline.end.z),
          },
        },
        profile: {
          shape: member.profile.shape,
          widthMm: roundMillimetre(member.profile.widthMm),
          depthMm: roundMillimetre(member.profile.depthMm),
          ...(member.profile.profileKey
            ? { profileKey: member.profile.profileKey }
            : {}),
          ...(member.profile.sectionOutline?.length
            ? {
                sectionOutline: canonicalizePolygon2(
                  member.profile.sectionOutline,
                ),
              }
            : {}),
          ...(member.profile.sectionVoids?.length
            ? {
                sectionVoids: member.profile.sectionVoids.map(
                  (voidBoundary) => canonicalizePolygon2(voidBoundary) ?? [],
                ),
              }
            : {}),
          ...(member.profile.anchors
            ? {
                anchors: {
                  undersideZ: roundMillimetre(
                    member.profile.anchors.undersideZ,
                  ),
                  topsideZ: roundMillimetre(member.profile.anchors.topsideZ),
                  backFaceY: roundMillimetre(member.profile.anchors.backFaceY),
                  frontFaceY: roundMillimetre(
                    member.profile.anchors.frontFaceY,
                  ),
                  roofBearingFaceY: roundMillimetre(
                    member.profile.anchors.roofBearingFaceY,
                  ),
                  roofBearingFaceZ: roundMillimetre(
                    member.profile.anchors.roofBearingFaceZ,
                  ),
                },
              }
            : {}),
        },
        localFrame: {
          origin: {
            x: roundMillimetre(member.localFrame.origin.x),
            y: roundMillimetre(member.localFrame.origin.y),
            z: roundMillimetre(member.localFrame.origin.z),
          },
          xAxis: {
            x: roundUnit(member.localFrame.xAxis.x),
            y: roundUnit(member.localFrame.xAxis.y),
            z: roundUnit(member.localFrame.xAxis.z),
          },
          yAxis: {
            x: roundUnit(member.localFrame.yAxis.x),
            y: roundUnit(member.localFrame.yAxis.y),
            z: roundUnit(member.localFrame.yAxis.z),
          },
          zAxis: {
            x: roundUnit(member.localFrame.zAxis.x),
            y: roundUnit(member.localFrame.zAxis.y),
            z: roundUnit(member.localFrame.zAxis.z),
          },
        },
        endCuts: canonicalizeEndCuts(member.endCuts),
        metadata: canonicalizeMetadata(member.metadata),
      })),
    roofPlanes: [...assembly.roofPlanes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(canonicalizeRoofPlane3D),
    roofCladdingPanels: [...(assembly.roofCladdingPanels ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((panel) => ({
        ...panel,
        thicknessMm: roundMillimetre(panel.thicknessMm),
        boundary: panel.boundary.map((point) => ({
          x: roundMillimetre(point.x),
          y: roundMillimetre(point.y),
          z: roundMillimetre(point.z),
        })),
        plane: {
          origin: {
            x: roundMillimetre(panel.plane.origin.x),
            y: roundMillimetre(panel.plane.origin.y),
            z: roundMillimetre(panel.plane.origin.z),
          },
          xAxis: {
            x: roundUnit(panel.plane.xAxis.x),
            y: roundUnit(panel.plane.xAxis.y),
            z: roundUnit(panel.plane.xAxis.z),
          },
          yAxis: {
            x: roundUnit(panel.plane.yAxis.x),
            y: roundUnit(panel.plane.yAxis.y),
            z: roundUnit(panel.plane.yAxis.z),
          },
          normal: {
            x: roundUnit(panel.plane.normal.x),
            y: roundUnit(panel.plane.normal.y),
            z: roundUnit(panel.plane.normal.z),
          },
        },
        metadata: canonicalizeMetadata(panel.metadata),
      })),
    ...(assembly.roofFlashings?.length
      ? {
          roofFlashings: [...assembly.roofFlashings]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map(canonicalizeRoofFlashing),
        }
      : {}),
    supportConditions: [...assembly.supportConditions]
      .sort((a, b) =>
        `${a.memberId}:${a.type}`.localeCompare(`${b.memberId}:${b.type}`),
      )
      .map((condition: AssemblySupportCondition) => ({
        ...condition,
        metadata: canonicalizeMetadata(condition.metadata),
      })),
    quantityHooks: [...assembly.quantityHooks]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((hook: QuantityHook) => ({
        key: hook.key,
        quantity: roundMillimetre(hook.quantity),
        unit: hook.unit,
      })),
    semantics: {
      connectionType: assembly.semantics.connectionType,
      roofType: assembly.semantics.roofType,
      structuralZones: [...assembly.semantics.structuralZones].sort(),
    },
  };
}

function arrayComparisonKey(path: string, value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (path === "members" && "id" in value && typeof value.id === "string")
    return value.id;
  if (path === "roofPlanes" && "id" in value && typeof value.id === "string")
    return value.id;
  if (
    path === "house.model.wallSegments" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  if (
    path === "house.model.roofPlanes" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  if (
    path === "house.model.roofFeatures" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  if (
    path === "house.model.roofFlashings" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  if (
    path === "roofCladdingPanels" &&
    "id" in value &&
    typeof value.id === "string"
  )
    return value.id;
  if (path === "roofFlashings" && "id" in value && typeof value.id === "string")
    return value.id;
  if (
    path === "quantityHooks" &&
    "key" in value &&
    typeof value.key === "string"
  )
    return value.key;
  if (
    path === "supportConditions" &&
    "memberId" in value &&
    "type" in value &&
    typeof value.memberId === "string" &&
    typeof value.type === "string"
  ) {
    return `${value.memberId}:${value.type}`;
  }
  return null;
}

function diffValues(
  path: string,
  actual: unknown,
  expected: unknown,
  diffs: CanonicalAssemblyDiffEntry[],
): void {
  if (Object.is(actual, expected)) return;

  if (Array.isArray(actual) && Array.isArray(expected)) {
    const keyedExpected = new Map<string, unknown>();
    const keyedActual = new Map<string, unknown>();
    let allKeyed = true;
    for (const item of expected) {
      const key = arrayComparisonKey(path, item);
      if (!key) {
        allKeyed = false;
        break;
      }
      keyedExpected.set(key, item);
    }
    if (allKeyed) {
      for (const item of actual) {
        const key = arrayComparisonKey(path, item);
        if (!key) {
          allKeyed = false;
          break;
        }
        keyedActual.set(key, item);
      }
    }

    if (allKeyed) {
      const keys = Array.from(
        new Set([...keyedActual.keys(), ...keyedExpected.keys()]),
      ).sort();
      for (const key of keys) {
        diffValues(
          `${path}.${key}`,
          keyedActual.get(key),
          keyedExpected.get(key),
          diffs,
        );
      }
      return;
    }

    const length = Math.max(actual.length, expected.length);
    for (let index = 0; index < length; index += 1) {
      diffValues(`${path}[${index}]`, actual[index], expected[index], diffs);
    }
    return;
  }

  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object"
  ) {
    const keys = Array.from(
      new Set([
        ...Object.keys(actual as object),
        ...Object.keys(expected as object),
      ]),
    ).sort();
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      diffValues(
        nextPath,
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        diffs,
      );
    }
    return;
  }

  diffs.push({ path, actual, expected });
}

export function diffCanonicalAssembly(
  actual: CanonicalAssembly3D,
  expected: CanonicalAssembly3D,
): CanonicalAssemblyDiffEntry[] {
  const diffs: CanonicalAssemblyDiffEntry[] = [];
  diffValues("", actual, expected, diffs);
  return diffs.filter((entry) => entry.path.length > 0);
}
