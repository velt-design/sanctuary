import type {
  Assembly3D,
  AssemblyMember3D,
  AssemblyMemberProfile,
  GeometrySectionLine2D,
  GeometrySectionMember2D,
  GeometrySectionViewModel,
  Line2,
  Point2,
  RoofFallDirection,
} from './contracts';

const SECTION_EPSILON_MM = 0.001;

function round(value: number, precision = 6): number {
  return Number(value.toFixed(precision));
}

function toSectionPoint(point: { y: number; z: number }): Point2 {
  return {
    x: round(point.y),
    y: round(point.z),
  };
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function averageX(member: AssemblyMember3D): number {
  return (member.centerline.start.x + member.centerline.end.x) / 2;
}

function averageY(member: AssemblyMember3D): number {
  return (member.centerline.start.y + member.centerline.end.y) / 2;
}

function averageZ(member: AssemblyMember3D): number {
  return (member.centerline.start.z + member.centerline.end.z) / 2;
}

function projectLineToSection(line: { start: { y: number; z: number }; end: { y: number; z: number } }): Line2 {
  return {
    start: toSectionPoint(line.start),
    end: toSectionPoint(line.end),
  };
}

function dedupePoints(points: Point2[], tolerance = 0.5): Point2[] {
  return points.filter(
    (point, index) =>
      points.findIndex((candidate) => Math.abs(candidate.x - point.x) <= tolerance && Math.abs(candidate.y - point.y) <= tolerance) === index,
  );
}

function intersectMemberAtSlice(member: AssemblyMember3D, sliceXMm: number): GeometrySectionMember2D | null {
  const { start, end } = member.centerline;

  if (Math.abs(start.x - sliceXMm) <= SECTION_EPSILON_MM && Math.abs(end.x - sliceXMm) <= SECTION_EPSILON_MM) {
    return {
      id: member.id,
      role: member.role,
      projection: projectLineToSection(member.centerline),
      profile: member.profile,
      metadata: member.metadata,
    };
  }

  const dx = end.x - start.x;
  if (Math.abs(dx) <= SECTION_EPSILON_MM) {
    return null;
  }

  const t = (sliceXMm - start.x) / dx;
  if (t < -SECTION_EPSILON_MM || t > 1 + SECTION_EPSILON_MM) {
    return null;
  }

  const y = start.y + (end.y - start.y) * t;
  const z = start.z + (end.z - start.z) * t;
  const point = toSectionPoint({ y, z });
  return {
    id: member.id,
    role: member.role,
    projection: {
      start: point,
      end: point,
    },
    profile: member.profile,
    metadata: member.metadata,
  };
}

function intersectBoundaryAtSlice(boundary: Array<{ x: number; y: number; z: number }>, sliceXMm: number): Line2 | null {
  const intersections: Point2[] = [];

  for (let index = 0; index < boundary.length; index += 1) {
    const start = boundary[index]!;
    const end = boundary[(index + 1) % boundary.length]!;

    if (Math.abs(start.x - sliceXMm) <= SECTION_EPSILON_MM && Math.abs(end.x - sliceXMm) <= SECTION_EPSILON_MM) {
      intersections.push(toSectionPoint(start), toSectionPoint(end));
      continue;
    }

    const dx = end.x - start.x;
    if (Math.abs(dx) <= SECTION_EPSILON_MM) {
      continue;
    }

    const t = (sliceXMm - start.x) / dx;
    if (t < -SECTION_EPSILON_MM || t > 1 + SECTION_EPSILON_MM) {
      continue;
    }

    const y = start.y + (end.y - start.y) * t;
    const z = start.z + (end.z - start.z) * t;
    intersections.push(toSectionPoint({ y, z }));
  }

  const unique = dedupePoints(intersections).sort((a, b) => a.x - b.x || a.y - b.y);
  if (unique.length < 2) {
    return null;
  }

  return {
    start: unique[0]!,
    end: unique[unique.length - 1]!,
  };
}

function buildSectionLine(id: string, kind: GeometrySectionLine2D['kind'], line: Line2, metadata?: Record<string, string | number | boolean | null>): GeometrySectionLine2D {
  return {
    id,
    kind,
    line,
    metadata,
  };
}

function findNearestMember(
  members: AssemblyMember3D[],
  predicate: (member: AssemblyMember3D) => boolean,
  targetY: number,
): AssemblyMember3D | null {
  return (
    [...members]
      .filter(predicate)
      .sort((a, b) => {
        const distance = Math.abs(averageY(a) - targetY) - Math.abs(averageY(b) - targetY);
        if (Math.abs(distance) > SECTION_EPSILON_MM) {
          return distance;
        }
        return a.id.localeCompare(b.id);
      })[0] ?? null
  );
}

function representativeProfile(member: AssemblyMember3D | null, fallback: AssemblyMemberProfile | null): AssemblyMemberProfile | null {
  return member?.profile ?? fallback ?? null;
}

function eaveUnderside(member: AssemblyMember3D | null): number | null {
  if (!member) return null;
  return round(averageZ(member) - member.profile.depthMm / 2, 3);
}

function ridgeUnderside(member: AssemblyMember3D | null): number | null {
  if (!member) return null;
  return round(averageZ(member) - member.profile.depthMm / 2, 3);
}

function pitchFromLine(line: Line2 | null, family: Assembly3D['family']): number | null {
  if (!line) return null;
  const run = Math.abs(line.end.x - line.start.x);
  const rise = Math.abs(line.end.y - line.start.y);
  if (run <= SECTION_EPSILON_MM) return family === 'gable' ? 0 : null;
  return round((Math.atan(rise / run) * 180) / Math.PI, 3);
}

function fallDirectionFromLine(line: Line2 | null, family: Assembly3D['family']): RoofFallDirection {
  if (family === 'gable') return 'dual';
  if (!line) return 'positiveY';
  return line.end.y > line.start.y ? 'positiveY' : 'negativeY';
}

function buildRepresentativeVerticalMember(
  id: string,
  role: GeometrySectionMember2D['role'],
  projectionMm: number,
  heightMm: number | null,
  profile: AssemblyMemberProfile | null,
): GeometrySectionMember2D[] {
  if (!profile || heightMm === null) return [];
  return [
    {
      id,
      role,
      projection: {
        start: { x: round(projectionMm), y: 0 },
        end: { x: round(projectionMm), y: round(heightMm) },
      },
      profile,
    },
  ];
}

export function buildSectionViewModel(assembly: Assembly3D): GeometrySectionViewModel {
  const xValues = assembly.outline.map((point) => point.x);
  const yValues = assembly.outline.map((point) => point.y);
  const sliceXMm = round((Math.min(...xValues) + Math.max(...xValues)) / 2, 3);
  const minY = round(Math.min(...yValues), 3);
  const maxY = round(Math.max(...yValues), 3);
  const baseline: Line2 = {
    start: { x: minY, y: 0 },
    end: { x: maxY, y: 0 },
  };

  const houseSideMember = findNearestMember(
    assembly.members,
    (member) => member.role === 'ledger' || member.role === 'beam' || member.role === 'gutter',
    minY,
  );
  const outerSideMember = findNearestMember(
    assembly.members,
    (member) => member.role === 'gutter' || member.role === 'beam',
    maxY,
  );
  const ridgeMember = findNearestMember(assembly.members, (member) => member.role === 'ridge', (minY + maxY) / 2);
  const leftEdgeHeightMm = eaveUnderside(houseSideMember);
  const rightEdgeHeightMm = eaveUnderside(outerSideMember);
  const ridgeHeightMm = ridgeUnderside(ridgeMember);

  const roofPlaneLines = sortById(
    assembly.roofPlanes
      .map((roofPlane) => {
        const line = intersectBoundaryAtSlice(roofPlane.boundary, sliceXMm);
        return line ? buildSectionLine(roofPlane.id, 'roof_plane', line, roofPlane.metadata) : null;
      })
      .filter((line): line is GeometrySectionLine2D => Boolean(line)),
  );

  const roofCladdingLines = sortById(
    (assembly.roofCladdingPanels ?? [])
      .map((panel) => {
        const line = intersectBoundaryAtSlice(panel.boundary, sliceXMm);
        return line ? buildSectionLine(panel.id, 'roof_cladding', line, panel.metadata) : null;
      })
      .filter((line): line is GeometrySectionLine2D => Boolean(line)),
  );

  const intersectedMembers = sortById(
    assembly.members
      .map((member) => intersectMemberAtSlice(member, sliceXMm))
      .filter((member): member is GeometrySectionMember2D => Boolean(member)),
  );

  const postProfile = representativeProfile(
    findNearestMember(assembly.members, (member) => member.role === 'post' && averageY(member) <= (minY + maxY) / 2, minY),
    null,
  );

  const syntheticPosts = [
    ...buildRepresentativeVerticalMember('section-house-post', 'post', minY, leftEdgeHeightMm, postProfile),
    ...buildRepresentativeVerticalMember('section-outer-post', 'post', maxY, rightEdgeHeightMm, postProfile),
  ];

  const posts = sortById([
    ...intersectedMembers.filter((member) => member.role === 'post'),
    ...syntheticPosts,
  ]).filter(
    (member, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.id === member.id ||
          (Math.abs(candidate.projection.start.x - member.projection.start.x) <= 0.5 &&
            Math.abs(candidate.projection.end.y - member.projection.end.y) <= 0.5),
      ) === index,
  );

  const ledgers = intersectedMembers.filter((member) => member.role === 'ledger');
  const supportBeams = intersectedMembers.filter((member) => member.role === 'beam' || member.role === 'brace');
  const gutters = intersectedMembers.filter((member) => member.role === 'gutter');
  const rafters = intersectedMembers.filter((member) => member.role === 'rafter');
  const ridge = intersectedMembers.filter((member) => member.role === 'ridge');
  const joiners = intersectedMembers.filter((member) => member.role === 'joiner');

  const primaryRoofLine = roofCladdingLines[0]?.line ?? roofPlaneLines[0]?.line ?? null;
  const pitchDeg = pitchFromLine(primaryRoofLine, assembly.family);
  const boxRiseMm =
    assembly.family === 'box' && primaryRoofLine
      ? round(Math.abs(primaryRoofLine.end.y - primaryRoofLine.start.y), 3)
      : null;

  const maxHeightCandidates = [
    0,
    ...roofPlaneLines.flatMap((line) => [line.line.start.y, line.line.end.y]),
    ...roofCladdingLines.flatMap((line) => [line.line.start.y, line.line.end.y]),
    ...intersectedMembers.flatMap((member) => [member.projection.start.y, member.projection.end.y]),
    ...(leftEdgeHeightMm !== null ? [leftEdgeHeightMm] : []),
    ...(rightEdgeHeightMm !== null ? [rightEdgeHeightMm] : []),
    ...(ridgeHeightMm !== null ? [ridgeHeightMm] : []),
  ];

  return {
    family: assembly.family,
    connectionType: assembly.semantics.connectionType,
    sectionKind: assembly.family === 'gable' ? 'gable' : 'mono',
    roofForm: {
      mono: assembly.family === 'mono',
      gable: assembly.family === 'gable',
      box: assembly.family === 'box',
    },
    sliceXMm,
    baseline,
    house: {
      referenceLine: assembly.attachmentEdge
        ? {
            start: { x: minY, y: 0 },
            end: { x: minY, y: round(Math.max(leftEdgeHeightMm ?? 0, 0)) },
          }
        : null,
    },
    members: {
      posts,
      ledgers,
      supportBeams,
      gutters,
      rafters,
      ridge,
      joiners,
    },
    surfaces: {
      roofPlanes: roofPlaneLines,
      roofCladding: roofCladdingLines,
    },
    anchors: {
      span: baseline,
      leftEdgeHeight:
        leftEdgeHeightMm === null
          ? null
          : {
              point: { x: minY, y: leftEdgeHeightMm },
              valueMm: leftEdgeHeightMm,
            },
      rightEdgeHeight:
        rightEdgeHeightMm === null
          ? null
          : {
              point: { x: maxY, y: rightEdgeHeightMm },
              valueMm: rightEdgeHeightMm,
            },
      ridgeHeight:
        ridgeHeightMm === null
          ? null
          : {
              point: {
                x: round((minY + maxY) / 2, 3),
                y: ridgeHeightMm,
              },
              valueMm: ridgeHeightMm,
            },
      pitch:
        primaryRoofLine && pitchDeg !== null
          ? {
              point: {
                x: round((primaryRoofLine.start.x + primaryRoofLine.end.x) / 2, 3),
                y: round((primaryRoofLine.start.y + primaryRoofLine.end.y) / 2, 3),
              },
              degrees: pitchDeg,
              fallDirection: fallDirectionFromLine(primaryRoofLine, assembly.family),
            }
          : null,
    },
    metrics: {
      spanMm: round(maxY - minY, 3),
      leftEdgeHeightMm,
      rightEdgeHeightMm,
      ridgeHeightMm,
      pitchDeg,
      boxRiseMm,
    },
    extents: {
      minProjectionMm: minY,
      maxProjectionMm: maxY,
      minHeightMm: 0,
      maxHeightMm: round(Math.max(...maxHeightCandidates), 3),
    },
  };
}
