import { describe, expect, it } from 'vitest';
import {
  resolveObjectFirstOpeningHost,
  resolveObjectFirstPergolaAttachment,
} from './objectFirstDerivedHosting';
import type {
  HouseAssemblyModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';

function point(alongM: string, depthM: string) {
  return { alongM, depthM };
}

function makeAssembly(overrides: Partial<HouseAssemblyModel> = {}): HouseAssemblyModel {
  return {
    id: 'assembly-main',
    label: 'Main House',
    houseForms: [],
    derivedEnvelope: {
      mergedFormIds: ['form-a', 'form-b'],
      footprint: [point('0', '0'), point('10', '0'), point('10', '4'), point('0', '4')],
      wallGraph: {
        walls: [
          {
            id: 'wall-merged',
            label: 'Merged Rear Wall',
            sourceFormIds: ['form-a', 'form-b'],
            edgeIds: ['edge-wall-main', 'edge-eave-main'],
            kind: 'exterior',
            polygon: [point('0', '0'), point('10', '0')],
          },
          {
            id: 'wall-secondary',
            label: 'Secondary Wall',
            sourceFormIds: ['form-b'],
            edgeIds: ['edge-wall-secondary', 'edge-eave-secondary'],
            kind: 'exterior',
            polygon: [point('10', '0'), point('10', '4')],
          },
        ],
        mergeGroups: [
          {
            id: 'merge-1',
            sourceFormIds: ['form-a', 'form-b'],
            wallIds: ['wall-merged'],
          },
        ],
      },
      roofZones: [
        {
          id: 'roof-zone-main',
          label: 'Merged Roof',
          sourceFormIds: ['form-a', 'form-b'],
          edgeIds: ['edge-eave-main'],
          boundary: [point('0', '0'), point('10', '0'), point('10', '4'), point('0', '4')],
        },
      ],
      edges: [
        {
          id: 'edge-eave-main',
          label: 'Merged Rear Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-a', 'form-b'],
          hostWallId: 'wall-merged',
          hostRoofZoneIds: ['roof-zone-main'],
          start: point('0', '0'),
          end: point('10', '0'),
        },
        {
          id: 'edge-eave-secondary',
          label: 'Secondary Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-secondary',
          hostRoofZoneIds: ['roof-zone-main'],
          start: point('10', '0'),
          end: point('10', '4'),
        },
      ],
      attachmentZones: [
        {
          id: 'zone-main',
          label: 'Merged Rear Soffit',
          kind: 'soffit',
          side: 'rear',
          sourceFormIds: ['form-a', 'form-b'],
          hostWallId: 'wall-merged',
          hostEdgeId: 'edge-eave-main',
          hostRoofZoneId: 'roof-zone-main',
        },
        {
          id: 'zone-secondary',
          label: 'Secondary Soffit',
          kind: 'soffit',
          side: 'right',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-secondary',
          hostEdgeId: 'edge-eave-secondary',
          hostRoofZoneId: 'roof-zone-main',
        },
      ],
    },
    ...overrides,
  };
}

function makeOpening(overrides: Partial<OpeningObjectModel> = {}): OpeningObjectModel {
  return {
    id: 'opening-1',
    label: 'Kitchen Slider',
    kind: 'slider',
    panelCount: 3,
    hostWallId: 'wall-merged',
    sourceFormId: 'form-a',
    widthM: '2.4',
    heightM: '2.1',
    sillHeightM: '0.2',
    offsetAlongWallM: '1.0',
    ...overrides,
  };
}

function makePergola(overrides: Partial<PergolaObjectModel> = {}): PergolaObjectModel {
  return {
    id: 'pergola-1',
    label: 'Rear Pergola',
    family: 'gable',
    attachmentEdgeId: 'edge-eave-main',
    attachmentZoneId: 'zone-main',
    side: 'rear',
    strategy: 'facade_ledger',
    ...overrides,
  };
}

describe('object-first derived hosting contracts', () => {
  it('resolves openings and pergolas against multi-form assembly-level derived outputs', () => {
    const houseAssembly = makeAssembly();

    const openingResolution = resolveObjectFirstOpeningHost({
      houseAssembly,
      opening: makeOpening(),
    });
    const pergolaResolution = resolveObjectFirstPergolaAttachment({
      houseAssembly,
      pergola: makePergola(),
    });

    expect(openingResolution).toMatchObject({
      status: 'resolved',
      code: null,
      hostWallId: 'wall-merged',
    });
    expect(openingResolution.wall?.sourceFormIds).toEqual(['form-a', 'form-b']);
    expect(pergolaResolution).toMatchObject({
      status: 'resolved',
      code: null,
      attachmentEdgeId: 'edge-eave-main',
      attachmentZoneId: 'zone-main',
    });
    expect(pergolaResolution.edge?.sourceFormIds).toEqual(['form-a', 'form-b']);
    expect(pergolaResolution.zone?.sourceFormIds).toEqual(['form-a', 'form-b']);
  });

  it('ignores opening sourceFormId because canonical hosting is derived-wall based', () => {
    const resolution = resolveObjectFirstOpeningHost({
      houseAssembly: makeAssembly(),
      opening: makeOpening({ sourceFormId: 'stale-form' }),
    });

    expect(resolution.status).toBe('resolved');
    expect(resolution.wall?.id).toBe('wall-merged');
  });

  it('keeps stale opening hostWallId unresolved instead of falling back by source form', () => {
    const resolution = resolveObjectFirstOpeningHost({
      houseAssembly: makeAssembly(),
      opening: makeOpening({ hostWallId: 'wall-missing', sourceFormId: 'form-a' }),
    });

    expect(resolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_host_wall',
      hostWallId: 'wall-missing',
      wall: null,
    });
  });

  it('resolves pergola edge-only attachment without requiring a zone', () => {
    const resolution = resolveObjectFirstPergolaAttachment({
      houseAssembly: makeAssembly(),
      pergola: makePergola({ attachmentZoneId: null }),
    });

    expect(resolution).toMatchObject({
      status: 'resolved',
      code: null,
      attachmentEdgeId: 'edge-eave-main',
      attachmentZoneId: null,
    });
    expect(resolution.edge?.id).toBe('edge-eave-main');
    expect(resolution.zone).toBeNull();
  });

  it('requires pergola attachment zones to match the resolved derived edge', () => {
    const resolution = resolveObjectFirstPergolaAttachment({
      houseAssembly: makeAssembly(),
      pergola: makePergola({
        attachmentEdgeId: 'edge-eave-main',
        attachmentZoneId: 'zone-secondary',
      }),
    });

    expect(resolution).toMatchObject({
      status: 'unresolved',
      code: 'attachment_zone_edge_mismatch',
      attachmentEdgeId: 'edge-eave-main',
      attachmentZoneId: 'zone-secondary',
    });
    expect(resolution.edge?.id).toBe('edge-eave-main');
    expect(resolution.zone?.hostEdgeId).toBe('edge-eave-secondary');
  });

  it('reports missing pergola attachment zones explicitly', () => {
    const resolution = resolveObjectFirstPergolaAttachment({
      houseAssembly: makeAssembly(),
      pergola: makePergola({ attachmentZoneId: 'zone-missing' }),
    });

    expect(resolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_attachment_zone',
      attachmentEdgeId: 'edge-eave-main',
      attachmentZoneId: 'zone-missing',
    });
    expect(resolution.edge?.id).toBe('edge-eave-main');
    expect(resolution.zone).toBeNull();
  });

  it('reports missing assembly and derived envelope without legacy fallbacks', () => {
    const openingResolution = resolveObjectFirstOpeningHost({
      houseAssembly: null,
      opening: makeOpening(),
    });
    const pergolaResolution = resolveObjectFirstPergolaAttachment({
      houseAssembly: makeAssembly({ derivedEnvelope: null }),
      pergola: makePergola(),
    });

    expect(openingResolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_assembly',
      wall: null,
    });
    expect(pergolaResolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_envelope',
      edge: null,
      zone: null,
    });
  });
});
