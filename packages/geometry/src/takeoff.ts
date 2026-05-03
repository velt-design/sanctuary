import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  AssemblyMemberRole,
  GeometryQuantityTakeoff,
  GeometryQuantityTakeoffDiagnostic,
  GeometryQuantityTakeoffDimensionSet,
  GeometryQuantityTakeoffMemberBucket,
  GeometryQuantityTakeoffMemberItem,
  GeometryQuantityTakeoffRoofCladdingMaterial,
  GeometryQuantityTakeoffRoofCladdingPanel,
  QuantityHook,
  RoofCladdingMaterial,
} from "./contracts";
import { lineLength, polygonArea } from "./math3d";

const MEMBER_ROLES: AssemblyMemberRole[] = [
  "post",
  "beam",
  "ledger",
  "ridge",
  "rafter",
  "gutter",
  "brace",
  "joiner",
];

function round(value: number, precision = 6): number {
  return Number(value.toFixed(precision));
}

function mmToM(value: number | null): number | null {
  return value == null ? null : round(value / 1000);
}

function mm2ToM2(value: number): number {
  return round(value / 1_000_000);
}

function dimensionsToM(
  dimensions: GeometryQuantityTakeoffDimensionSet | null,
): GeometryQuantityTakeoffDimensionSet | null {
  return dimensions
    ? {
        length: round(dimensions.length / 1000),
        projection: round(dimensions.projection / 1000),
      }
    : null;
}

function dimensionsFromOutline(assembly: Assembly3D): GeometryQuantityTakeoffDimensionSet | null {
  if (assembly.outline.length === 0) return null;
  const xValues = assembly.outline.map((point) => point.x);
  const yValues = assembly.outline.map((point) => point.y);
  return {
    length: round(Math.max(...xValues) - Math.min(...xValues)),
    projection: round(Math.max(...yValues) - Math.min(...yValues)),
  };
}

function profileKey(profile: AssemblyMemberProfile): string {
  return profile.profileKey ?? `${profile.depthMm}x${profile.widthMm}`;
}

function sortMemberItems(items: GeometryQuantityTakeoffMemberItem[]): GeometryQuantityTakeoffMemberItem[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function buildMemberItem(member: AssemblyMember3D): GeometryQuantityTakeoffMemberItem {
  const lengthMm = round(lineLength(member.centerline), 6);
  return {
    id: member.id,
    role: member.role,
    lengthMm,
    lengthM: round(lengthMm / 1000),
    profile: member.profile,
    profileKey: profileKey(member.profile),
    metadata: member.metadata,
  };
}

function sortQuantityHooks(hooks: QuantityHook[]): QuantityHook[] {
  return [...hooks]
    .map((hook) => ({ ...hook }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function totalMemberLength(members: AssemblyMember3D[]): number {
  return round(
    members.reduce((sum, member) => sum + lineLength(member.centerline), 0),
    6,
  );
}

function buildMemberBucket(
  role: AssemblyMemberRole,
  members: AssemblyMember3D[],
): GeometryQuantityTakeoffMemberBucket {
  const items = sortMemberItems(members.map(buildMemberItem));
  const totalLengthMm = round(items.reduce((sum, item) => sum + item.lengthMm, 0), 6);
  const profileKeys = Array.from(new Set(items.map((item) => item.profileKey))).sort(
    (a, b) => a.localeCompare(b),
  );
  const averageLengthMm = items.length ? round(totalLengthMm / items.length, 6) : null;

  return {
    role,
    count: items.length,
    totalLengthMm,
    totalLengthM: round(totalLengthMm / 1000),
    averageLengthMm,
    averageLengthM: mmToM(averageLengthMm),
    firstProfile: items[0]?.profile ?? null,
    profileKeys,
    items,
  };
}

function sumLengthOrNull(members: AssemblyMember3D[]): number | null {
  return members.length ? totalMemberLength(members) : null;
}

function buildQuantityHookMap(hooks: QuantityHook[]): Record<string, number> {
  return Object.fromEntries(hooks.map((hook) => [hook.key, hook.quantity]));
}

function metadataString(metadata: Assembly3D["members"][number]["metadata"], key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function resolveRoofPlaneId(
  assembly: Assembly3D,
  metadata: Assembly3D["members"][number]["metadata"],
  source: { id: string; kind: "member" | "roof_cladding_panel" },
  diagnostics: GeometryQuantityTakeoffDiagnostic[],
): string | null {
  if (assembly.roofPlanes.length === 0) return null;

  for (const explicitKey of ["roofPlaneId", "roofPlane", "planeId"]) {
    const explicitId = metadataString(metadata, explicitKey);
    if (!explicitId) continue;
    if (assembly.roofPlanes.some((plane) => plane.id === explicitId)) return explicitId;
    diagnostics.push({
      code: "takeoff_roof_plane_reference_missing",
      message: `${source.kind} ${source.id} references missing roof plane ${explicitId}.`,
    });
    return null;
  }

  for (const groupingKey of ["slope", "wing"]) {
    const groupingValue = metadataString(metadata, groupingKey);
    if (!groupingValue) continue;
    const matches = assembly.roofPlanes.filter(
      (plane) => metadataString(plane.metadata, groupingKey) === groupingValue,
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) {
      diagnostics.push({
        code: "takeoff_roof_plane_reference_ambiguous",
        message: `${source.kind} ${source.id} matches multiple roof planes by ${groupingKey} ${groupingValue}.`,
      });
      return null;
    }
  }

  if (assembly.roofPlanes.length === 1) return assembly.roofPlanes[0].id;
  return null;
}

function buildRoofCladdingItems(
  assembly: Assembly3D,
  diagnostics: GeometryQuantityTakeoffDiagnostic[],
): GeometryQuantityTakeoffRoofCladdingPanel[] {
  return [...assembly.roofCladdingPanels]
    .map((panel) => {
      const areaMm2 = round(polygonArea(panel.boundary));
      return {
        id: panel.id,
        material: panel.material,
        areaMm2,
        areaM2: mm2ToM2(areaMm2),
        thicknessMm: panel.thicknessMm,
        roofPlaneId: resolveRoofPlaneId(
          assembly,
          panel.metadata,
          { id: panel.id, kind: "roof_cladding_panel" },
          diagnostics,
        ),
        metadata: panel.metadata,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildRoofCladdingByMaterial(
  items: GeometryQuantityTakeoffRoofCladdingPanel[],
): GeometryQuantityTakeoffRoofCladdingMaterial[] {
  const groups = new Map<
    RoofCladdingMaterial,
    { material: RoofCladdingMaterial; panelCount: number; areaMm2: number }
  >();

  for (const panel of items) {
    const existing = groups.get(panel.material) ?? {
      material: panel.material,
      panelCount: 0,
      areaMm2: 0,
    };
    existing.panelCount += 1;
    existing.areaMm2 += panel.areaMm2;
    groups.set(panel.material, existing);
  }

  return Array.from(groups.values())
    .map((group) => ({
      material: group.material,
      panelCount: group.panelCount,
      areaMm2: round(group.areaMm2),
      areaM2: mm2ToM2(group.areaMm2),
    }))
    .sort((a, b) => a.material.localeCompare(b.material));
}

function averageItemLengthMm(items: GeometryQuantityTakeoffMemberItem[]): number | null {
  return items.length
    ? round(items.reduce((sum, item) => sum + item.lengthMm, 0) / items.length, 6)
    : null;
}

export function buildAssemblyQuantityTakeoff(assembly: Assembly3D): GeometryQuantityTakeoff {
  const diagnostics: GeometryQuantityTakeoffDiagnostic[] = [];
  const quantityHooks = sortQuantityHooks(assembly.quantityHooks);
  const primaryDimensionsMm =
    assembly.semantics.primaryDimensionsMm ?? dimensionsFromOutline(assembly);
  const secondaryDimensionsMm = assembly.semantics.secondaryDimensionsMm ?? null;
  const membersByRole = Object.fromEntries(
    MEMBER_ROLES.map((role) => [
      role,
      buildMemberBucket(
        role,
        assembly.members.filter((member) => member.role === role),
      ),
    ]),
  ) as Record<AssemblyMemberRole, GeometryQuantityTakeoffMemberBucket>;
  const memberItems = sortMemberItems(Object.values(membersByRole).flatMap((bucket) => bucket.items));
  const roofCladdingItems = buildRoofCladdingItems(assembly, diagnostics);
  const rafterRoofPlaneIds = new Map(
    membersByRole.rafter.items.map((item) => [
      item.id,
      resolveRoofPlaneId(assembly, item.metadata, { id: item.id, kind: "member" }, diagnostics),
    ]),
  );
  const joinerRoofPlaneIds = new Map(
    membersByRole.joiner.items.map((item) => [
      item.id,
      resolveRoofPlaneId(assembly, item.metadata, { id: item.id, kind: "member" }, diagnostics),
    ]),
  );

  const roofPlaneItems = [...assembly.roofPlanes]
    .map((plane) => {
      const areaMm2 = round(polygonArea(plane.boundary));
      const rafters = membersByRole.rafter.items.filter((item) => rafterRoofPlaneIds.get(item.id) === plane.id);
      const joiners = membersByRole.joiner.items.filter((item) => joinerRoofPlaneIds.get(item.id) === plane.id);
      const claddingPanels = roofCladdingItems.filter((panel) => panel.roofPlaneId === plane.id);
      const rafterTotalLengthMm = round(rafters.reduce((sum, item) => sum + item.lengthMm, 0));
      const joinerTotalLengthMm = round(joiners.reduce((sum, item) => sum + item.lengthMm, 0));
      const claddingAreaMm2 = round(claddingPanels.reduce((sum, panel) => sum + panel.areaMm2, 0));
      const rafterAverageLengthMm = averageItemLengthMm(rafters);
      const joinerAverageLengthMm = averageItemLengthMm(joiners);
      return {
        id: plane.id,
        label: typeof plane.metadata?.label === "string" ? plane.metadata.label : undefined,
        areaMm2,
        areaM2: mm2ToM2(areaMm2),
        rafterCount: rafters.length,
        rafterTotalLengthMm,
        rafterTotalLengthM: mmToM(rafterTotalLengthMm) ?? 0,
        rafterAverageLengthMm,
        rafterAverageLengthM: mmToM(rafterAverageLengthMm),
        claddingPanelCount: claddingPanels.length,
        claddingAreaMm2,
        claddingAreaM2: mm2ToM2(claddingAreaMm2),
        joinerCount: joiners.length,
        joinerTotalLengthMm,
        joinerTotalLengthM: mmToM(joinerTotalLengthMm) ?? 0,
        joinerAverageLengthMm,
        joinerAverageLengthM: mmToM(joinerAverageLengthMm),
        metadata: plane.metadata,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const roofPlaneAreaMm2 = round(
    roofPlaneItems.reduce((sum, plane) => sum + plane.areaMm2, 0),
  );

  const supportBeamMembers = assembly.members.filter(
    (member) => member.role === "beam" && member.metadata?.frameRole !== "tie_beam",
  );
  const tieBeamMembers = assembly.members.filter(
    (member) => member.metadata?.frameRole === "tie_beam",
  );
  const ledgerLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "ledger"),
  );
  const supportBeamLengthMm = sumLengthOrNull(supportBeamMembers);
  const ridgeLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "ridge"),
  );
  const tieBeamLengthMm = sumLengthOrNull(tieBeamMembers);
  const totalBeamLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "beam"),
  );

  const houseGutterLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "gutter" && member.id === "house-gutter"),
  );
  const ourGutterLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "gutter" && member.id !== "house-gutter"),
  );
  const totalGutterLengthMm = sumLengthOrNull(
    assembly.members.filter((member) => member.role === "gutter"),
  );
  const ledgerItems = membersByRole.ledger.items;
  const supportBeamItems = sortMemberItems(supportBeamMembers.map(buildMemberItem));
  const ridgeItems = membersByRole.ridge.items;
  const tieBeamItems = sortMemberItems(tieBeamMembers.map(buildMemberItem));
  const gutterItems = membersByRole.gutter.items;
  const houseGutterItems = gutterItems.filter((item) => item.id === "house-gutter");
  const ourGutterItems = gutterItems.filter((item) => item.id !== "house-gutter");

  const roofCladdingByMaterial = buildRoofCladdingByMaterial(roofCladdingItems);
  const roofCladdingAreaMm2 = round(
    roofCladdingByMaterial.reduce((sum, material) => sum + material.areaMm2, 0),
  );
  const acrylicCladding = roofCladdingByMaterial.find((material) => material.material === "acrylic");
  const joiners = membersByRole.joiner;

  const totalMemberLengthMm = round(
    MEMBER_ROLES.reduce((sum, role) => sum + membersByRole[role].totalLengthMm, 0),
  );

  return {
    family: assembly.family,
    primaryDimensionsMm,
    primaryDimensionsM: dimensionsToM(primaryDimensionsMm),
    secondaryDimensionsMm,
    secondaryDimensionsM: dimensionsToM(secondaryDimensionsMm),
    roofPlanes: {
      count: roofPlaneItems.length,
      totalAreaMm2: roofPlaneAreaMm2,
      totalAreaM2: mm2ToM2(roofPlaneAreaMm2),
      items: roofPlaneItems,
    },
    members: {
      totalCount: assembly.members.length,
      totalLengthMm: totalMemberLengthMm,
      totalLengthM: round(totalMemberLengthMm / 1000),
      items: memberItems,
      byRole: membersByRole,
    },
    beams: {
      ledgerLengthMm,
      ledgerLengthM: mmToM(ledgerLengthMm),
      supportBeamLengthMm,
      supportBeamLengthM: mmToM(supportBeamLengthMm),
      ridgeLengthMm,
      ridgeLengthM: mmToM(ridgeLengthMm),
      tieBeamLengthMm,
      tieBeamLengthM: mmToM(tieBeamLengthMm),
      totalBeamLengthMm,
      totalBeamLengthM: mmToM(totalBeamLengthMm),
      ledgerItems,
      supportBeamItems,
      ridgeItems,
      tieBeamItems,
    },
    gutters: {
      ourGutterLengthMm,
      ourGutterLengthM: mmToM(ourGutterLengthMm),
      houseGutterLengthMm,
      houseGutterLengthM: mmToM(houseGutterLengthMm),
      totalLengthMm: totalGutterLengthMm,
      totalLengthM: mmToM(totalGutterLengthMm),
      items: gutterItems,
      ourItems: ourGutterItems,
      houseItems: houseGutterItems,
    },
    roofCladding: {
      panelCount: assembly.roofCladdingPanels.length,
      totalAreaMm2: roofCladdingAreaMm2,
      totalAreaM2: mm2ToM2(roofCladdingAreaMm2),
      acrylicAreaMm2: acrylicCladding?.areaMm2 ?? null,
      acrylicAreaM2: acrylicCladding?.areaM2 ?? null,
      items: roofCladdingItems,
      byMaterial: roofCladdingByMaterial,
    },
    joiners: {
      count: joiners.count,
      totalLengthMm: joiners.totalLengthMm,
      totalLengthM: joiners.totalLengthM,
      averageLengthMm: joiners.averageLengthMm,
      averageLengthM: joiners.averageLengthM,
      items: joiners.items,
    },
    quantityHooks,
    quantityHookMap: buildQuantityHookMap(quantityHooks),
    diagnostics,
  };
}
