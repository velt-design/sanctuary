import { describe, expect, it } from 'vitest';
import type {
  GeometryTopProjectionShape,
  HouseModel3D,
  Line3,
  Plane3,
  ViewerSceneLayer,
  ViewerSceneModel,
  ViewerSceneObject,
} from '@sp/geometry';
import { buildProjectPergolaViewerSceneFromPergolaArtifacts } from './projectPergolaViewerScene';

const WALL_PLANE: Plane3 = {
  origin: { x: 0, y: 0, z: 0 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 0, z: 1 },
  normal: { x: 0, y: -1, z: 0 },
};

const ROOF_PLANE: Plane3 = {
  origin: { x: 0, y: 0, z: 2400 },
  xAxis: { x: 1, y: 0, z: 0 },
  yAxis: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};

const ROOF_LINE: Line3 = {
  start: { x: 0, y: 0, z: 2400 },
  end: { x: 1200, y: 0, z: 2400 },
};

function fakeReferenceObject(id: string): ViewerSceneObject {
  return {
    id,
    type: 'reference_line',
    kind: 'attachment_edge',
    sourceId: id,
    line: {
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
    },
  } as ViewerSceneObject;
}

function fakeLayer(id: string, objectId: string): ViewerSceneLayer {
  return {
    id,
    label: id,
    visibleByDefault: true,
    objects: [fakeReferenceObject(objectId)],
  };
}

function fakeHouseModel(houseId: string): HouseModel3D {
  return {
    houseId,
    footprint: [
      { x: 0, y: -1000, z: 0 },
      { x: 1200, y: -1000, z: 0 },
      { x: 1200, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
    wallSegments: [
      {
        id: 'wall-1',
        sourceEdgeId: 'edge-1',
        line: {
          start: { x: 0, y: 0, z: 2400 },
          end: { x: 1200, y: 0, z: 2400 },
        },
        boundary: [
          { x: 0, y: 0, z: 0 },
          { x: 1200, y: 0, z: 0 },
          { x: 1200, y: 0, z: 2400 },
          { x: 0, y: 0, z: 2400 },
        ],
        plane: WALL_PLANE,
        metadata: {},
      },
    ],
    roofPlanes: [],
    roofFeatures: [],
    roofFlashings: [],
    decks: [],
    openings: [],
    eave: {
      soffitDepthMm: null,
      fasciaHeightMm: null,
    },
    attachmentTarget: null,
  } as unknown as HouseModel3D;
}

function layerObjectIds(scene: ViewerSceneModel, layerId: string): string[] {
  return scene.layers.find((layer) => layer.id === layerId)?.objects.map((object) => object.id) ?? [];
}

function fallbackPlanShape(pergolaId: string): GeometryTopProjectionShape {
  return {
    id: `pergola_reference:${pergolaId}`,
    sourceObjectId: pergolaId,
    sourceId: pergolaId,
    sourceType: 'pergola_reference',
    family: 'pergola',
    kind: 'outline',
    polygon: [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 800 },
      { x: 0, y: 800 },
    ],
    zOrder: 0,
    zMin: 0,
    zMax: 2400,
    metadata: {
      pergolaId,
      renderRole: 'diagnostic_fallback',
      fallbackReason: 'unresolved_host',
    },
  };
}

describe('buildProjectPergolaViewerSceneFromPergolaArtifacts', () => {
  it('uses project house layers instead of basis or pergola artifact house layers', () => {
    const basisScene: ViewerSceneModel = {
      layers: [
        fakeLayer('house', 'basis-house'),
        fakeLayer('posts', 'basis-post'),
      ],
    };

    const scene = buildProjectPergolaViewerSceneFromPergolaArtifacts({
      basisScene,
      pergolaArtifacts: [
        {
          pergolaId: 'pergola-1',
          viewerScene: {
            layers: [
              fakeLayer('house', 'pergola-artifact-house'),
              fakeLayer('posts', 'pergola-artifact-post'),
            ],
          },
        },
      ],
      projectHouseGeometries: [
        {
          houseFormId: 'house-form-2',
          model: fakeHouseModel('house-form-2'),
        },
      ],
    });

    expect(layerObjectIds(scene, 'house')).toEqual([
      'house-form-2:wall-1',
      'house-form-2:wall-1-edge',
    ]);
    expect(layerObjectIds(scene, 'posts')).toEqual([
      'project_pergola:pergola-1:pergola-artifact-post',
    ]);
  });

  it('adds unresolved pergolas as diagnostic reference-line fallbacks, not committed pergola bodies', () => {
    const basisScene: ViewerSceneModel = {
      layers: [
        fakeLayer('house', 'basis-house'),
        fakeLayer('posts', 'basis-post'),
      ],
    };

    const scene = buildProjectPergolaViewerSceneFromPergolaArtifacts({
      basisScene,
      pergolaArtifacts: [],
      projectHouseGeometries: [],
      projectPergolaRenderHealth: [
        {
          pergolaId: 'pergola-2',
          canRenderCommittedBody: false,
          suppressedCommittedBodyReason: 'unresolved_host',
        },
      ],
      projectPergolaFallbackPlanShapes: [fallbackPlanShape('pergola-2')],
    });

    expect(layerObjectIds(scene, 'posts')).toEqual([]);
    expect(layerObjectIds(scene, 'project_pergola_fallbacks')).toEqual([
      'project_pergola_fallback:pergola-2:edge-1',
      'project_pergola_fallback:pergola-2:edge-2',
      'project_pergola_fallback:pergola-2:edge-3',
      'project_pergola_fallback:pergola-2:edge-4',
    ]);
    expect(scene.metadata?.projectPergolaFallbackIds).toBe('pergola-2');
  });

  it('can build a diagnostic project scene without a ready committed basis scene', () => {
    const scene = buildProjectPergolaViewerSceneFromPergolaArtifacts({
      basisScene: null,
      pergolaArtifacts: [],
      projectHouseGeometries: [
        {
          houseFormId: 'house-form-1',
          model: fakeHouseModel('house-form-1'),
        },
      ],
      projectPergolaRenderHealth: [
        {
          pergolaId: 'pergola-2',
          canRenderCommittedBody: false,
          suppressedCommittedBodyReason: 'unresolved_host',
        },
      ],
      projectPergolaFallbackPlanShapes: [fallbackPlanShape('pergola-2')],
    });

    expect(layerObjectIds(scene, 'house')).toContain('house-form-1:wall-1');
    expect(layerObjectIds(scene, 'project_pergola_fallbacks')).toEqual([
      'project_pergola_fallback:pergola-2:edge-1',
      'project_pergola_fallback:pergola-2:edge-2',
      'project_pergola_fallback:pergola-2:edge-3',
      'project_pergola_fallback:pergola-2:edge-4',
    ]);
    expect(scene.metadata?.projectPergolaSceneCount).toBe(0);
  });
});
