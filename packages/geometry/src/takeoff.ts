import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  AssemblyMemberRole,
  GeometryQuantityTakeoff,
  GeometryQuantityTakeoffDimensionSet,
  GeometryQuantityTakeoffMemberBucket,
  GeometryQuantityTakeoffRoofCladdingMaterial,
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
  const totalLengthMm = totalMemberLength(members);
  const profileKeys = Array.from(new Set(members.map((member) => profileKey(member.profile)))).sort(
    (a, b) => a.localeCompare(b),
  );
  const averageLengthMm = members.length ? round(totalLengthMm / members.length, 6) : null;

  return {
    role,
    count: members.length,
    totalLengthMm,
    totalLengthM: round(totalLengthMm / 1000),
    averageLengthMm,
    averageLengthM: mmToM(averageLengthMm),
    firstProfile: members[0]?.profile ?? null,
    profileKeys,
  };
}

function sumLengthOrNull(members: AssemblyMember3D[]): number | null {
  return members.length ? totalMemberLength(members) : null;
}

function buildQuantityHookMap(hooks: QuantityHook[]): Record<string, number> {
  return Object.fromEntries(hooks.map((hook) => [hook.key, hook.quantity]));
}

function buildRoofCladdingByMaterial(
  assembly: Assembly3D,
): GeometryQuantityTakeoffRoofCladdingMaterial[] {
  const groups = new Map<
    RoofCladdingMaterial,
    { material: RoofCladdingMaterial; panelCount: number; areaMm2: number }
  >();

  for (const panel of assembly.roofCladdingPanels) {
    const areaMm2 = polygonArea(panel.boundary);
    const existing = groups.get(panel.material) ?? {
      material: panel.material,
      panelCount: 0,
      areaMm2: 0,
    };
    existing.panelCount += 1;
    existing.areaMm2 += areaMm2;
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

export function buildAssemblyQuantityTakeoff(assembly: Assembly3D): GeometryQuantityTakeoff {
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

  const roofPlaneItems = [...assembly.roofPlanes]
    .map((plane) => {
      const areaMm2 = round(polygonArea(plane.boundary));
      return {
        id: plane.id,
        label: typeof plane.metadata?.label === "string" ? plane.metadata.label : undefined,
        areaMm2,
        areaM2: mm2ToM2(areaMm2),
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

  const roofCladdingByMaterial = buildRoofCladdingByMaterial(assembly);
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
    },
    gutters: {
      ourGutterLengthMm,
      ourGutterLengthM: mmToM(ourGutterLengthMm),
      houseGutterLengthMm,
      houseGutterLengthM: mmToM(houseGutterLengthMm),
      totalLengthMm: totalGutterLengthMm,
      totalLengthM: mmToM(totalGutterLengthMm),
    },
    roofCladding: {
      panelCount: assembly.roofCladdingPanels.length,
      totalAreaMm2: roofCladdingAreaMm2,
      totalAreaM2: mm2ToM2(roofCladdingAreaMm2),
      acrylicAreaMm2: acrylicCladding?.areaMm2 ?? null,
      acrylicAreaM2: acrylicCladding?.areaM2 ?? null,
      byMaterial: roofCladdingByMaterial,
    },
    joiners: {
      count: joiners.count,
      totalLengthMm: joiners.totalLengthMm,
      totalLengthM: joiners.totalLengthM,
      averageLengthMm: joiners.averageLengthMm,
      averageLengthM: joiners.averageLengthM,
    },
    quantityHooks,
    quantityHookMap: buildQuantityHookMap(quantityHooks),
    diagnostics: [],
  };
}
