import { describe, expect, it } from 'vitest';
import {
  buildPergolaInteractionAnchors,
  solveAssembly3D,
  type Assembly3D,
  type GeometryConfig,
} from '@sp/geometry';
import { makeBoxConfig, makeGableConfig, makeMonoConfig } from './fixtures/builders';

function solve(assemblyConfig: GeometryConfig): Assembly3D {
  const result = solveAssembly3D(assemblyConfig);
  if (!result.ok) {
    throw new Error(`Expected geometry solve to succeed: ${result.code}`);
  }
  return result.value;
}

describe('buildPergolaInteractionAnchors', () => {
  it('derives transformed semantic edges, normals, and lighting runs from Assembly3D', () => {
    const assembly = solve(
      makeMonoConfig({
        position: {
          origin: { x: 10_000, y: 20_000 },
          rotationDeg: 90,
        },
      }),
    );

    const anchors = buildPergolaInteractionAnchors(assembly);

    expect(anchors.edges.map((edge) => edge.id)).toEqual([
      'front',
      'left',
      'right',
      'rear',
    ]);
    expect(anchors.edges.map((edge) => ({
      id: edge.id,
      start: { x: edge.centerline.start.x, y: edge.centerline.start.y },
      end: { x: edge.centerline.end.x, y: edge.centerline.end.y },
      outwardNormal: edge.outwardNormal,
    }))).toEqual([
      {
        id: 'front',
        start: { x: 7_000, y: 20_000 },
        end: { x: 7_000, y: 26_000 },
        outwardNormal: { x: -1, y: 0, z: 0 },
      },
      {
        id: 'left',
        start: { x: 10_000, y: 20_000 },
        end: { x: 7_000, y: 20_000 },
        outwardNormal: { x: 0, y: -1, z: 0 },
      },
      {
        id: 'right',
        start: { x: 10_000, y: 26_000 },
        end: { x: 7_000, y: 26_000 },
        outwardNormal: { x: 0, y: 1, z: 0 },
      },
      {
        id: 'rear',
        start: { x: 10_000, y: 20_000 },
        end: { x: 10_000, y: 26_000 },
        outwardNormal: { x: 1, y: 0, z: 0 },
      },
    ]);
    for (const edge of anchors.edges) {
      expect(edge.bottomZ).toBe(0);
      expect(edge.topZ).toBeGreaterThan(0);
      expect(edge.centerline.start.z).toBe((edge.bottomZ + edge.topZ) / 2);
      expect(edge.centerline.end.z).toBe((edge.bottomZ + edge.topZ) / 2);
    }

    const expectedRafterIds = assembly.members
      .filter((member) => member.role === 'rafter')
      .map((member) => `rafter:${member.id}`)
      .sort();
    expect(
      anchors.lightingRuns
        .filter((run) => run.kind === 'rafter')
        .map((run) => run.id),
    ).toEqual(expectedRafterIds);
    expect(
      anchors.lightingRuns
        .filter((run) => run.kind === 'perimeter')
        .map((run) => run.id),
    ).toEqual([
      'perimeter:front',
      'perimeter:left',
      'perimeter:right',
      'perimeter:rear',
    ]);
  });

  it('derives hosted only from attachmentEdge rather than connection semantics', () => {
    const attachedAssembly = solve(makeMonoConfig());
    const attachedAnchors = buildPergolaInteractionAnchors(attachedAssembly);
    expect(attachedAnchors.edges.filter((edge) => edge.hosted).map((edge) => edge.id)).toEqual([
      'rear',
    ]);

    const noAttachmentAnchors = buildPergolaInteractionAnchors({
      ...attachedAssembly,
      attachmentEdge: null,
    });
    expect(noAttachmentAnchors.edges.some((edge) => edge.hosted)).toBe(false);

    const freestandingAssembly = solve(
      makeMonoConfig({
        connection: { type: 'freestanding' },
        supports: { postCount: 4 },
      }),
    );
    expect(freestandingAssembly.attachmentEdge).toBeNull();
    expect(
      buildPergolaInteractionAnchors(freestandingAssembly).edges.some(
        (edge) => edge.hosted,
      ),
    ).toBe(false);
  });

  it('keeps assembly-scoped IDs stable across non-geometric assembly changes', () => {
    const gableResult = solveAssembly3D(makeGableConfig());
    if (!gableResult.ok) {
      throw new Error(`Expected geometry solve to succeed: ${gableResult.code}`);
    }
    const assembly = gableResult.value;
    const changedMetadata: Assembly3D = {
      ...assembly,
      members: assembly.members.map((member) => ({
        ...member,
        metadata: { ...member.metadata, finish: 'custom-colour' },
      })),
    };

    const before = buildPergolaInteractionAnchors(assembly);
    const after = buildPergolaInteractionAnchors(changedMetadata);

    expect(after.edges.map((edge) => edge.id)).toEqual(before.edges.map((edge) => edge.id));
    expect(after.lightingRuns.map((run) => run.id)).toEqual(
      before.lightingRuns.map((run) => run.id),
    );
  });

  it.each([
    ['mono', makeMonoConfig()],
    ['gable', makeGableConfig()],
    ['hip', makeGableConfig({ family: 'hip' })],
    ['box', makeBoxConfig()],
  ] as const)('derives the four-edge contract for the V1 %s family', (_family, config) => {
    const anchors = buildPergolaInteractionAnchors(solve(config));

    expect(anchors.edges.map((edge) => edge.id)).toEqual([
      'front',
      'left',
      'right',
      'rear',
    ]);
    expect(anchors.lightingRuns.some((run) => run.kind === 'rafter')).toBe(true);
    expect(anchors.lightingRuns.filter((run) => run.kind === 'perimeter')).toHaveLength(4);
  });
});
