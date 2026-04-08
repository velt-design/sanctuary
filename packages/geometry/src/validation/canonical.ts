import type {
  Assembly3D,
  AssemblySupportCondition,
  GeometryMetadata,
  GeometryMetadataValue,
  QuantityHook,
} from '../contracts';

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

function canonicalizeMetadataValue(value: GeometryMetadataValue): GeometryMetadataValue {
  if (typeof value === 'number') {
    return roundUnit(value);
  }
  return value;
}

function canonicalizeMetadata(metadata: GeometryMetadata | undefined): GeometryMetadata | undefined {
  if (!metadata) return undefined;
  const next: GeometryMetadata = {};
  for (const key of Object.keys(metadata).sort()) {
    next[key] = canonicalizeMetadataValue(metadata[key]!);
  }
  return next;
}

export function canonicalizeAssembly3D(assembly: Assembly3D): CanonicalAssembly3D {
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
      fasciaLine: assembly.house.fasciaLine
        ? {
            start: {
              x: roundMillimetre(assembly.house.fasciaLine.start.x),
              y: roundMillimetre(assembly.house.fasciaLine.start.y),
              z: roundMillimetre(assembly.house.fasciaLine.start.z),
            },
            end: {
              x: roundMillimetre(assembly.house.fasciaLine.end.x),
              y: roundMillimetre(assembly.house.fasciaLine.end.y),
              z: roundMillimetre(assembly.house.fasciaLine.end.z),
            },
          }
        : null,
      roofEdgeLine: assembly.house.roofEdgeLine
        ? {
            start: {
              x: roundMillimetre(assembly.house.roofEdgeLine.start.x),
              y: roundMillimetre(assembly.house.roofEdgeLine.start.y),
              z: roundMillimetre(assembly.house.roofEdgeLine.start.z),
            },
            end: {
              x: roundMillimetre(assembly.house.roofEdgeLine.end.x),
              y: roundMillimetre(assembly.house.roofEdgeLine.end.y),
              z: roundMillimetre(assembly.house.roofEdgeLine.end.z),
            },
          }
        : null,
      soffitDepthMm:
        typeof assembly.house.soffitDepthMm === 'number' ? roundMillimetre(assembly.house.soffitDepthMm) : assembly.house.soffitDepthMm ?? null,
      footprint:
        assembly.house.footprint?.map((point) => ({
          x: roundMillimetre(point.x),
          y: roundMillimetre(point.y),
          z: roundMillimetre(point.z),
        })) ?? null,
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
        metadata: canonicalizeMetadata(member.metadata),
      })),
    roofPlanes: [...assembly.roofPlanes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((roofPlane) => ({
        ...roofPlane,
        boundary: roofPlane.boundary.map((point) => ({
          x: roundMillimetre(point.x),
          y: roundMillimetre(point.y),
          z: roundMillimetre(point.z),
        })),
        plane: {
          origin: {
            x: roundMillimetre(roofPlane.plane.origin.x),
            y: roundMillimetre(roofPlane.plane.origin.y),
            z: roundMillimetre(roofPlane.plane.origin.z),
          },
          xAxis: {
            x: roundUnit(roofPlane.plane.xAxis.x),
            y: roundUnit(roofPlane.plane.xAxis.y),
            z: roundUnit(roofPlane.plane.xAxis.z),
          },
          yAxis: {
            x: roundUnit(roofPlane.plane.yAxis.x),
            y: roundUnit(roofPlane.plane.yAxis.y),
            z: roundUnit(roofPlane.plane.yAxis.z),
          },
          normal: {
            x: roundUnit(roofPlane.plane.normal.x),
            y: roundUnit(roofPlane.plane.normal.y),
            z: roundUnit(roofPlane.plane.normal.z),
          },
        },
        fallVector: {
          x: roundUnit(roofPlane.fallVector.x),
          y: roundUnit(roofPlane.fallVector.y),
          z: roundUnit(roofPlane.fallVector.z),
        },
        metadata: canonicalizeMetadata(roofPlane.metadata),
      })),
    supportConditions: [...assembly.supportConditions]
      .sort((a, b) => `${a.memberId}:${a.type}`.localeCompare(`${b.memberId}:${b.type}`))
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
  if (!value || typeof value !== 'object') return null;
  if (path === 'members' && 'id' in value && typeof value.id === 'string') return value.id;
  if (path === 'roofPlanes' && 'id' in value && typeof value.id === 'string') return value.id;
  if (path === 'quantityHooks' && 'key' in value && typeof value.key === 'string') return value.key;
  if (
    path === 'supportConditions' &&
    'memberId' in value &&
    'type' in value &&
    typeof value.memberId === 'string' &&
    typeof value.type === 'string'
  ) {
    return `${value.memberId}:${value.type}`;
  }
  return null;
}

function diffValues(path: string, actual: unknown, expected: unknown, diffs: CanonicalAssemblyDiffEntry[]): void {
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
      const keys = Array.from(new Set([...keyedActual.keys(), ...keyedExpected.keys()])).sort();
      for (const key of keys) {
        diffValues(`${path}.${key}`, keyedActual.get(key), keyedExpected.get(key), diffs);
      }
      return;
    }

    const length = Math.max(actual.length, expected.length);
    for (let index = 0; index < length; index += 1) {
      diffValues(`${path}[${index}]`, actual[index], expected[index], diffs);
    }
    return;
  }

  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    const keys = Array.from(new Set([...Object.keys(actual as object), ...Object.keys(expected as object)])).sort();
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
  diffValues('', actual, expected, diffs);
  return diffs.filter((entry) => entry.path.length > 0);
}
