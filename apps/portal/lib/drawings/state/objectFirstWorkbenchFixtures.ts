import type {
  DeckObjectModel,
  HouseAssemblyModel,
  HouseFormModel,
  ObjectFirstWorkbenchProjectModel,
  OpeningObjectModel,
  PergolaObjectModel,
} from './objectFirstWorkbenchModel';

type ObjectFirstWorkbenchFixtureId = 'separate_forms' | 'touching_merged_forms' | 'stale_hosts';

function point(alongM: string, depthM: string) {
  return { alongM, depthM };
}

function makeHouseForm(input: {
  id: string;
  label: string;
  offsetXM: number;
  attachmentSide: 'rear' | 'front' | 'left' | 'right';
}): HouseFormModel {
  const roofIntent = {
    form: 'mono' as const,
    material: 'corrugated_iron' as const,
    primaryPitchDeg: '5',
    primaryFallDirection: 'negative_y' as const,
    ridgeAxis: 'x' as const,
    openGableEndIds: [] as string[],
  };
  return {
    id: input.id,
    label: input.label,
    transform: { offsetXM: input.offsetXM, offsetYM: 0, rotationQuarterTurns: 0 },
    composition: {
      primitives: [
        {
          kind: 'axisAlignedRectangle' as const,
          originXMm: 0,
          originYMm: -4000,
          widthMm: 6000,
          depthMm: 4000,
          roofIntent: { form: 'mono' as const, pitchDeg: 5, fallDirection: 'negative_y' as const },
        },
      ],
      joins: [],
    },
    attachmentSide: input.attachmentSide,
    roofIntent,
    storeyMode: 'single_storey',
    attachmentStrategy: null,
    sourceModuleIndexes: [],
    sourceModuleIds: [],
  };
}

function makeDeck(overrides: Partial<DeckObjectModel> = {}): DeckObjectModel {
  return {
    id: 'deck-a',
    // PR-T9 (2026-05-29): `label`, `kind`, `elevationMode` removed.
    shape: 'preset',
    presetType: 'rect_attached',
    outline: [point('1', '0'), point('5', '0'), point('5', '3'), point('1', '3')],
    levelOffsetMm: '0',
    isAttached: true,
    surfaceMaterial: 'timber_decking',
    hostEdgeId: 'rear',
    ...overrides,
  };
}

function makeOpening(overrides: Partial<OpeningObjectModel> = {}): OpeningObjectModel {
  return {
    id: 'opening-merged',
    label: 'Merged Wall Window',
    kind: 'window',
    panelCount: null,
    hostWallId: 'wall-merged-rear',
    sourceFormId: 'form-a',
    widthM: '1.8',
    heightM: '1.2',
    sillHeightM: '0.9',
    offsetAlongWallM: '1.0',
    ...overrides,
  };
}

function makePergola(overrides: Partial<PergolaObjectModel> = {}): PergolaObjectModel {
  return {
    id: 'pergola-merged',
    label: 'Merged Rear Pergola',
    family: 'mono',
    attachmentEdgeId: 'edge-merged-eave',
    attachmentZoneId: 'zone-merged-soffit',
    side: 'rear',
    strategy: 'soffit_brackets',
    ...overrides,
  };
}

function makeSeparateAssembly(): HouseAssemblyModel {
  return {
    id: 'assembly-main',
    label: 'Main House',
    houseForms: [
      makeHouseForm({ id: 'form-a', label: 'House Form A', offsetXM: 0, attachmentSide: 'rear' }),
      makeHouseForm({ id: 'form-b', label: 'House Form B', offsetXM: 9, attachmentSide: 'rear' }),
    ],
    derivedEnvelope: {
      mergedFormIds: ['form-a', 'form-b'],
      footprint: [point('0', '0'), point('15', '0'), point('15', '4'), point('0', '4')],
      wallGraph: {
        walls: [
          {
            id: 'wall-a-rear',
            label: 'Form A Rear Wall',
            sourceFormIds: ['form-a'],
            edgeIds: ['edge-a-eave'],
            kind: 'exterior',
            polygon: [point('0', '0'), point('6', '0')],
          },
          {
            id: 'wall-b-rear',
            label: 'Form B Rear Wall',
            sourceFormIds: ['form-b'],
            edgeIds: ['edge-b-eave'],
            kind: 'exterior',
            polygon: [point('9', '0'), point('15', '0')],
          },
        ],
        mergeGroups: [],
      },
      roofZones: [
        {
          id: 'roof-zone-a',
          label: 'Form A Roof',
          sourceFormIds: ['form-a'],
          edgeIds: ['edge-a-eave'],
          boundary: [point('0', '0'), point('6', '0'), point('6', '4'), point('0', '4')],
        },
        {
          id: 'roof-zone-b',
          label: 'Form B Roof',
          sourceFormIds: ['form-b'],
          edgeIds: ['edge-b-eave'],
          boundary: [point('9', '0'), point('15', '0'), point('15', '4'), point('9', '4')],
        },
      ],
      edges: [
        {
          id: 'edge-a-eave',
          label: 'Form A Rear Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-a'],
          hostWallId: 'wall-a-rear',
          hostRoofZoneIds: ['roof-zone-a'],
          start: point('0', '0'),
          end: point('6', '0'),
        },
        {
          id: 'edge-b-eave',
          label: 'Form B Rear Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-b-rear',
          hostRoofZoneIds: ['roof-zone-b'],
          start: point('9', '0'),
          end: point('15', '0'),
        },
      ],
      attachmentZones: [
        {
          id: 'zone-a-soffit',
          label: 'Form A Rear Soffit',
          kind: 'soffit',
          side: 'rear',
          sourceFormIds: ['form-a'],
          hostWallId: 'wall-a-rear',
          hostEdgeId: 'edge-a-eave',
          hostRoofZoneId: 'roof-zone-a',
        },
        {
          id: 'zone-b-soffit',
          label: 'Form B Rear Soffit',
          kind: 'soffit',
          side: 'rear',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-b-rear',
          hostEdgeId: 'edge-b-eave',
          hostRoofZoneId: 'roof-zone-b',
        },
      ],
    },
  };
}

function makeTouchingAssembly(): HouseAssemblyModel {
  return {
    id: 'assembly-main',
    label: 'Main House',
    houseForms: [
      makeHouseForm({ id: 'form-a', label: 'House Form A', offsetXM: 0, attachmentSide: 'rear' }),
      makeHouseForm({ id: 'form-b', label: 'House Form B', offsetXM: 6, attachmentSide: 'rear' }),
    ],
    derivedEnvelope: {
      mergedFormIds: ['form-a', 'form-b'],
      footprint: [point('0', '0'), point('12', '0'), point('12', '4'), point('0', '4')],
      wallGraph: {
        walls: [
          {
            id: 'wall-merged-rear',
            label: 'Merged Rear Wall',
            sourceFormIds: ['form-a', 'form-b'],
            edgeIds: ['edge-merged-eave'],
            kind: 'exterior',
            polygon: [point('0', '0'), point('12', '0')],
          },
          {
            id: 'wall-b-right',
            label: 'Form B Right Wall',
            sourceFormIds: ['form-b'],
            edgeIds: ['edge-b-right-eave'],
            kind: 'exterior',
            polygon: [point('12', '0'), point('12', '4')],
          },
        ],
        mergeGroups: [
          {
            id: 'merge-touching-rear',
            sourceFormIds: ['form-a', 'form-b'],
            wallIds: ['wall-merged-rear'],
          },
        ],
      },
      roofZones: [
        {
          id: 'roof-zone-merged',
          label: 'Merged Roof Zone',
          sourceFormIds: ['form-a', 'form-b'],
          edgeIds: ['edge-merged-eave', 'edge-b-right-eave'],
          boundary: [point('0', '0'), point('12', '0'), point('12', '4'), point('0', '4')],
        },
      ],
      edges: [
        {
          id: 'edge-merged-eave',
          label: 'Merged Rear Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-a', 'form-b'],
          hostWallId: 'wall-merged-rear',
          hostRoofZoneIds: ['roof-zone-merged'],
          start: point('0', '0'),
          end: point('12', '0'),
        },
        {
          id: 'edge-b-right-eave',
          label: 'Form B Right Eave',
          semanticKind: 'eave',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-b-right',
          hostRoofZoneIds: ['roof-zone-merged'],
          start: point('12', '0'),
          end: point('12', '4'),
        },
      ],
      attachmentZones: [
        {
          id: 'zone-merged-soffit',
          label: 'Merged Rear Soffit',
          kind: 'soffit',
          side: 'rear',
          sourceFormIds: ['form-a', 'form-b'],
          hostWallId: 'wall-merged-rear',
          hostEdgeId: 'edge-merged-eave',
          hostRoofZoneId: 'roof-zone-merged',
        },
        {
          id: 'zone-b-right-soffit',
          label: 'Right Soffit',
          kind: 'soffit',
          side: 'right',
          sourceFormIds: ['form-b'],
          hostWallId: 'wall-b-right',
          hostEdgeId: 'edge-b-right-eave',
          hostRoofZoneId: 'roof-zone-merged',
        },
      ],
    },
  };
}

function buildProject(input: {
  houseAssembly: HouseAssemblyModel;
  decks?: DeckObjectModel[];
  openings?: OpeningObjectModel[];
  pergolas?: PergolaObjectModel[];
  warnings?: string[];
}): ObjectFirstWorkbenchProjectModel {
  return {
    source: 'legacy_estimate_snapshot',
    houseAssembly: input.houseAssembly,
    decks: input.decks ?? [makeDeck()],
    openings: input.openings ?? [makeOpening()],
    pergolas: input.pergolas ?? [makePergola()],
    warnings: input.warnings ?? [],
  };
}

export function makeObjectFirstWorkbenchProjectFixture(
  id: ObjectFirstWorkbenchFixtureId,
): ObjectFirstWorkbenchProjectModel {
  switch (id) {
    case 'separate_forms':
      return buildProject({
        houseAssembly: makeSeparateAssembly(),
        openings: [
          makeOpening({
            id: 'opening-a',
            label: 'Form A Window',
            hostWallId: 'wall-a-rear',
            sourceFormId: 'form-a',
          }),
          makeOpening({
            id: 'opening-b',
            label: 'Form B Window',
            hostWallId: 'wall-b-rear',
            sourceFormId: 'form-b',
          }),
        ],
        pergolas: [
          makePergola({
            id: 'pergola-a',
            label: 'Form A Pergola',
            attachmentEdgeId: 'edge-a-eave',
            attachmentZoneId: 'zone-a-soffit',
          }),
          makePergola({
            id: 'pergola-b',
            label: 'Form B Pergola',
            attachmentEdgeId: 'edge-b-eave',
            attachmentZoneId: 'zone-b-soffit',
          }),
        ],
      });
    case 'stale_hosts':
      return buildProject({
        houseAssembly: makeTouchingAssembly(),
        openings: [
          makeOpening({
            id: 'opening-stale-wall',
            hostWallId: 'wall-removed',
            sourceFormId: 'form-a',
          }),
        ],
        pergolas: [
          makePergola({
            id: 'pergola-stale-edge',
            attachmentEdgeId: 'edge-removed',
            attachmentZoneId: null,
          }),
          makePergola({
            id: 'pergola-zone-mismatch',
            attachmentEdgeId: 'edge-merged-eave',
            attachmentZoneId: 'zone-b-right-soffit',
          }),
        ],
        warnings: ['Object-first fixture contains stale hosted object references.'],
      });
    case 'touching_merged_forms':
    default:
      return buildProject({
        houseAssembly: makeTouchingAssembly(),
      });
  }
}
