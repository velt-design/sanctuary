import { describe, expect, it } from 'vitest';
import type {
  HouseAssemblyModel,
  ObjectFirstWorkbenchProjectModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';

function makePolygon() {
  return [
    { alongM: '0', depthM: '0' },
    { alongM: '6', depthM: '0' },
    { alongM: '6', depthM: '4' },
    { alongM: '0', depthM: '4' },
  ];
}

function makeFootprintParams() {
  return {
    widthM: '6',
    offsetXM: '0',
    setbackM: '0',
    bandDepthM: '4',
    returnRunM: '0',
    recessWidthM: '0',
    recessDepthM: '0',
    leftLegRunM: '0',
    rightLegRunM: '0',
    sideRunM: '0',
  };
}

describe('objectFirstWorkbenchModel contracts', () => {
  it('expresses a house assembly as multiple independently movable house forms', () => {
    const assembly: HouseAssemblyModel = {
      id: 'assembly-main',
      label: 'Main House',
      houseForms: [
        {
          id: 'form-a',
          label: 'Form A',
          transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
          footprint: {
            mode: 'preset',
            preset: 'straight',
            params: makeFootprintParams(),
            polygon: makePolygon(),
            attachmentSide: 'rear',
          },
          roofIntent: {
            form: 'gable',
            material: 'corrugated_iron',
            primaryPitchDeg: '7',
            primaryFallDirection: 'negative_y',
            ridgeAxis: 'x',
            openGableEndIds: [],
            appendage: {
              enabled: false,
              form: 'flat',
              hostEdge: 'rear',
              pitchDeg: '0',
              dropMm: '0',
            },
          },
          storeyMode: 'single_storey',
          attachmentStrategy: null,
        },
        {
          id: 'form-b',
          label: 'Form B',
          transform: { offsetXM: 4, offsetYM: 0, rotationQuarterTurns: 1 },
          footprint: {
            mode: 'preset',
            preset: 'straight',
            params: makeFootprintParams(),
            polygon: makePolygon(),
            attachmentSide: 'left',
          },
          roofIntent: {
            form: 'mono',
            material: 'corrugated_iron',
            primaryPitchDeg: '5',
            primaryFallDirection: 'negative_x',
            ridgeAxis: 'y',
            openGableEndIds: [],
            appendage: {
              enabled: false,
              form: 'flat',
              hostEdge: 'left',
              pitchDeg: '0',
              dropMm: '0',
            },
          },
          storeyMode: 'single_storey',
          attachmentStrategy: null,
        },
      ],
      derivedEnvelope: {
        mergedFormIds: ['form-a', 'form-b'],
        footprint: [
          { alongM: '0', depthM: '0' },
          { alongM: '10', depthM: '0' },
          { alongM: '10', depthM: '4' },
          { alongM: '0', depthM: '4' },
        ],
        wallGraph: {
          walls: [
            {
              id: 'wall-1',
              label: 'South Wall',
              sourceFormIds: ['form-a', 'form-b'],
              edgeIds: ['edge-wall-1', 'edge-eave-1'],
              kind: 'exterior',
              polygon: [
                { alongM: '0', depthM: '0' },
                { alongM: '10', depthM: '0' },
              ],
            },
          ],
          mergeGroups: [
            {
              id: 'merge-1',
              sourceFormIds: ['form-a', 'form-b'],
              wallIds: ['wall-1'],
            },
          ],
        },
        roofZones: [
          {
            id: 'roof-zone-1',
            label: 'Merged Roof',
            sourceFormIds: ['form-a', 'form-b'],
            edgeIds: ['edge-ridge-1', 'edge-eave-1'],
            boundary: makePolygon(),
          },
        ],
        edges: [
          {
            id: 'edge-wall-1',
            label: 'South Wall Perimeter',
            semanticKind: 'wall_perimeter',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostRoofZoneIds: [],
            start: { alongM: '0', depthM: '0' },
            end: { alongM: '10', depthM: '0' },
          },
          {
            id: 'edge-eave-1',
            label: 'South Eave',
            semanticKind: 'eave',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostRoofZoneIds: ['roof-zone-1'],
            start: { alongM: '0', depthM: '0' },
            end: { alongM: '10', depthM: '0' },
          },
          {
            id: 'edge-ridge-1',
            label: 'Main Ridge',
            semanticKind: 'ridge',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: null,
            hostRoofZoneIds: ['roof-zone-1'],
            start: { alongM: '2', depthM: '2' },
            end: { alongM: '8', depthM: '2' },
          },
        ],
        attachmentZones: [
          {
            id: 'zone-1',
            label: 'South Fascia',
            kind: 'fascia',
            side: 'rear',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostEdgeId: 'edge-eave-1',
            hostRoofZoneId: 'roof-zone-1',
          },
        ],
      },
    };

    expect(assembly.houseForms).toHaveLength(2);
    expect(assembly.houseForms[0]?.transform.offsetXM).toBe(0);
    expect(assembly.houseForms[1]?.transform.offsetXM).toBe(4);
    expect(assembly.derivedEnvelope?.mergedFormIds).toEqual(['form-a', 'form-b']);
    expect(assembly.derivedEnvelope?.edges.map((edge) => edge.id)).toEqual([
      'edge-wall-1',
      'edge-eave-1',
      'edge-ridge-1',
    ]);
    expect(assembly.derivedEnvelope?.wallGraph.walls[0]?.edgeIds).toEqual(['edge-wall-1', 'edge-eave-1']);
    expect(assembly.derivedEnvelope?.roofZones[0]?.edgeIds).toEqual(['edge-ridge-1', 'edge-eave-1']);
    expect(assembly.derivedEnvelope?.attachmentZones[0]).toMatchObject({
      hostWallId: 'wall-1',
      hostEdgeId: 'edge-eave-1',
      hostRoofZoneId: 'roof-zone-1',
    });
  });

  it('treats opening hosting as a derived wall contract', () => {
    const opening: OpeningObjectModel = {
      id: 'opening-1',
      label: 'Kitchen Slider',
      kind: 'slider',
      panelCount: 3,
      hostWallId: 'wall-1',
      sourceFormId: 'form-a',
      widthM: '2.4',
      heightM: '2.1',
      sillHeightM: '0.2',
      offsetAlongWallM: '1.0',
    };

    expect(opening.hostWallId).toBe('wall-1');
    expect(opening.sourceFormId).toBe('form-a');
  });

  it('treats pergola attachment as a derived envelope contract', () => {
    const pergola: PergolaObjectModel = {
      id: 'pergola-1',
      label: 'Rear Pergola',
      family: 'gable',
      attachmentEdgeId: 'edge-south',
      attachmentZoneId: 'zone-1',
      side: 'rear',
      strategy: 'facade_ledger',
    };

    expect(pergola.attachmentEdgeId).toBe('edge-south');
    expect(pergola.attachmentZoneId).toBe('zone-1');
  });

  it('keeps derived edges as the assembly-level bridge for hosted objects', () => {
    const assembly: HouseAssemblyModel = {
      id: 'assembly-main',
      label: 'Main House',
      houseForms: [],
      derivedEnvelope: {
        mergedFormIds: ['form-a', 'form-b'],
        footprint: makePolygon(),
        wallGraph: {
          walls: [
            {
              id: 'wall-1',
              label: 'Rear Wall',
              sourceFormIds: ['form-a', 'form-b'],
              edgeIds: ['edge-wall-1'],
              kind: 'exterior',
              polygon: [
                { alongM: '0', depthM: '0' },
                { alongM: '6', depthM: '0' },
              ],
            },
          ],
          mergeGroups: [],
        },
        roofZones: [
          {
            id: 'roof-zone-1',
            label: 'Roof Zone 1',
            sourceFormIds: ['form-a', 'form-b'],
            edgeIds: ['edge-eave-1'],
            boundary: makePolygon(),
          },
        ],
        edges: [
          {
            id: 'edge-wall-1',
            label: 'Rear Wall Edge',
            semanticKind: 'wall_perimeter',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostRoofZoneIds: [],
            start: { alongM: '0', depthM: '0' },
            end: { alongM: '6', depthM: '0' },
          },
          {
            id: 'edge-eave-1',
            label: 'Rear Eave',
            semanticKind: 'eave',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostRoofZoneIds: ['roof-zone-1'],
            start: { alongM: '0', depthM: '0' },
            end: { alongM: '6', depthM: '0' },
          },
        ],
        attachmentZones: [
          {
            id: 'zone-1',
            label: 'Rear Soffit',
            kind: 'soffit',
            side: 'rear',
            sourceFormIds: ['form-a', 'form-b'],
            hostWallId: 'wall-1',
            hostEdgeId: 'edge-eave-1',
            hostRoofZoneId: 'roof-zone-1',
          },
        ],
      },
    };

    expect(assembly.derivedEnvelope?.edges[1]).toMatchObject({
      semanticKind: 'eave',
      hostWallId: 'wall-1',
      hostRoofZoneIds: ['roof-zone-1'],
    });
    expect(assembly.derivedEnvelope?.attachmentZones[0]?.hostEdgeId).toBe('edge-eave-1');
  });

  it('keeps the project contract object-first instead of exposing a single shared house footprint', () => {
    const project: ObjectFirstWorkbenchProjectModel = {
      source: 'legacy_estimate_snapshot',
      houseAssembly: {
        id: 'assembly-main',
        label: 'Main House',
        houseForms: [],
        derivedEnvelope: null,
      },
      decks: [],
      openings: [],
      pergolas: [],
      warnings: [],
    };

    expect(project.houseAssembly?.houseForms).toEqual([]);
    expect('house' in project).toBe(false);
  });
});
