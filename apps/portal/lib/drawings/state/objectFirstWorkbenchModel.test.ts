import { describe, expect, it } from 'vitest';
import type {
  HouseAssembly,
  HouseForm,
  ObjectFirstWorkbenchProjectModel,
  Opening,
  Pergola,
  PergolaAttachment,
  WorkbenchProjectModel,
} from './objectFirstWorkbenchModel';
import {
  normalizeObjectFirstHouseFormDraft,
  normalizeObjectFirstPergolaDraft,
  normalizePergolaAttachment,
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
    const houseForms: HouseForm[] = [
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
          form: 'hipped',
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
    ];

    const assembly: HouseAssembly = {
      id: 'assembly-main',
      label: 'Main House',
      houseForms,
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
    const opening: Opening = {
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
    const pergola: Pergola = {
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
    const assembly: HouseAssembly = {
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
    const project: WorkbenchProjectModel = {
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

    const legacyAliasProject: ObjectFirstWorkbenchProjectModel = project;
    expect(legacyAliasProject.houseAssembly?.houseForms).toEqual([]);
  });
});

describe('normalizeObjectFirstHouseFormDraft — gable→hipped migration (slice 2)', () => {
  // Milestone 13 deep migration: legacy `form: 'gable'` records with an
  // explicit footprint polygon migrate to `form: 'hipped' +
  // openGableEndIds: <all terminals>` at the draft normalize boundary.
  // The geometry pipeline already treated those two representations as
  // equivalent; the migration makes the workbench state explicit so
  // every UI consumer (rail labels, inspector toggles) reads coherent
  // state. See decision-log 2026-05-13 "House Roof Topology" entry.

  function makeRectangularPolygon() {
    return [
      { alongM: '0', depthM: '0' },
      { alongM: '6', depthM: '0' },
      { alongM: '6', depthM: '4' },
      { alongM: '0', depthM: '4' },
    ];
  }

  function makeGableDraft(overrides: { polygon?: Array<{ alongM: string; depthM: string }>; openGableEndIds?: string[] } = {}) {
    return {
      id: 'house-main',
      label: 'Main',
      transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 as const },
      footprint: {
        mode: 'custom_polygon' as const,
        preset: 'straight' as const,
        params: makeFootprintParams(),
        polygon: overrides.polygon ?? makeRectangularPolygon(),
        attachmentSide: 'rear' as const,
        position: null,
      },
      // Cast: `'gable'` is no longer in the `HouseRoofForm` union
      // (session C), but storage may still carry it -- this fixture
      // simulates legacy storage to verify the normalize-boundary
      // migration still maps it to `'hipped'`.
      roofIntent: {
        form: 'gable' as unknown as 'hipped',
        material: 'corrugated_iron' as const,
        primaryPitchDeg: '15',
        primaryFallDirection: 'positive_y' as const,
        ridgeAxis: 'x' as const,
        openGableEndIds: overrides.openGableEndIds ?? [],
        appendage: {
          enabled: false,
          form: 'flat' as const,
          hostEdge: 'rear' as const,
          pitchDeg: '0',
          dropMm: '0',
        },
      },
      storeyMode: 'single_storey' as const,
      attachmentStrategy: null,
      sourceModuleIndexes: [],
      sourceModuleIds: [],
    };
  }

  it("migrates a custom-polygon gable house to form: 'hipped' with all terminals open", () => {
    const draft = normalizeObjectFirstHouseFormDraft(makeGableDraft());
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.roofIntent.form).toBe('hipped');
    // Rectangle with ridge axis x produces exactly two terminal ends.
    // Don't pin specific IDs (they are edge-index based and may change
    // if `deriveHouseGableTerminalEnds` internals shift); just assert
    // the count, distinctness, and naming-convention prefix.
    expect(draft.roofIntent.openGableEndIds).toHaveLength(2);
    expect(new Set(draft.roofIntent.openGableEndIds).size).toBe(2);
    for (const id of draft.roofIntent.openGableEndIds) {
      expect(id).toMatch(/^house-gable-end-x-\d+$/);
    }
  });

  it('preserves stored openGableEndIds when migrating (union semantics match the geometry compat layer)', () => {
    // Seed with an end id that doesn't match the derived rectangle
    // terminals to verify the stored ids are preserved AND the
    // derived terminals are added (union semantics).
    const draft = normalizeObjectFirstHouseFormDraft(
      makeGableDraft({ openGableEndIds: ['house-gable-end-x-legacy'] }),
    );
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.roofIntent.form).toBe('hipped');
    // Stored "legacy" id preserved + derived terminals appended.
    expect(draft.roofIntent.openGableEndIds).toContain('house-gable-end-x-legacy');
    expect(draft.roofIntent.openGableEndIds.length).toBeGreaterThanOrEqual(2);
  });

  it("migrates form to 'hipped' even when polygon is empty (preset-mode); openGableEndIds stays empty since no terminals can be derived", () => {
    // Slice 2 left preset-mode as form: 'gable'. Session C closes the
    // loop -- legacy gable input ALWAYS migrates the form name; only
    // the openGableEndIds seeding requires an explicit polygon. The
    // remaining preset-mode case is the documented regression in the
    // session C decision-log entry.
    const draft = normalizeObjectFirstHouseFormDraft(makeGableDraft({ polygon: [] }));
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.roofIntent.form).toBe('hipped');
    expect(draft.roofIntent.openGableEndIds).toEqual([]);
  });

  it("leaves form: 'hipped' houses untouched", () => {
    const draft = normalizeObjectFirstHouseFormDraft({
      ...makeGableDraft(),
      roofIntent: {
        ...makeGableDraft().roofIntent,
        form: 'hipped' as const,
        openGableEndIds: ['house-gable-end-x-1'],
      },
    });
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.roofIntent.form).toBe('hipped');
    expect(draft.roofIntent.openGableEndIds).toEqual(['house-gable-end-x-1']);
  });

  it('preserves all non-form roof-intent fields during migration', () => {
    const draft = normalizeObjectFirstHouseFormDraft(makeGableDraft());
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(draft.roofIntent.material).toBe('corrugated_iron');
    expect(draft.roofIntent.primaryPitchDeg).toBe('15');
    expect(draft.roofIntent.primaryFallDirection).toBe('positive_y');
    expect(draft.roofIntent.ridgeAxis).toBe('x');
    expect(draft.roofIntent.appendage.enabled).toBe(false);
  });
});

describe('normalizePergolaAttachment', () => {
  // Step 8 of the first-class spatial-entities migration. Locks the
  // invariants tied to spatialKind/method/host so malformed input from a
  // future caller can't silently corrupt the persisted shape.

  it('returns null when input is null/undefined', () => {
    expect(normalizePergolaAttachment(null)).toBeNull();
    expect(normalizePergolaAttachment(undefined)).toBeNull();
  });

  it('returns null when spatialKind is missing or invalid', () => {
    expect(normalizePergolaAttachment({})).toBeNull();
    expect(normalizePergolaAttachment({ spatialKind: 'bogus' as never })).toBeNull();
  });

  it('builds a freestanding attachment with no host and method=none', () => {
    const result = normalizePergolaAttachment({
      spatialKind: 'freestanding',
      // Even if host is provided, freestanding strips it.
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'wall',
        edgeId: 'wall-1',
        myEdgeIndex: 0,
      },
      method: 'fascia_under_gutter',
    });
    expect(result).toEqual({
      spatialKind: 'freestanding',
      host: null,
      method: 'none',
    });
  });

  it('coerces method to facade_ledger for spatialKind=wall', () => {
    const result = normalizePergolaAttachment({
      spatialKind: 'wall',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'wall',
        edgeId: 'wall-1',
        myEdgeIndex: 2,
      },
      method: 'fascia_under_gutter', // Wrong choice, gets coerced.
    });
    expect(result?.spatialKind).toBe('wall');
    expect(result?.method).toBe('facade_ledger');
    expect(result?.host?.edgeId).toBe('wall-1');
  });

  it('preserves user-picked method for spatialKind=roof_edge', () => {
    const result = normalizePergolaAttachment({
      spatialKind: 'roof_edge',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'roof_eave',
        edgeId: 'roof-eave-edge-1',
        myEdgeIndex: 2,
      },
      method: 'soffit_brackets',
    });
    expect(result?.method).toBe('soffit_brackets');
  });

  it('defaults spatialKind=roof_edge to fascia_under_gutter when method is missing or invalid', () => {
    const result = normalizePergolaAttachment({
      spatialKind: 'roof_edge',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'roof_eave',
        edgeId: 'roof-eave-edge-1',
        myEdgeIndex: 2,
      },
      // method omitted
    });
    expect(result?.method).toBe('fascia_under_gutter');
  });

  it('rejects spatialKind=roof_edge methods that belong to a different spatialKind', () => {
    // facade_ledger is for spatialKind=wall, not roof_edge — should be coerced.
    const result = normalizePergolaAttachment({
      spatialKind: 'roof_edge',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'roof_eave',
        edgeId: 'roof-eave-edge-1',
        myEdgeIndex: 2,
      },
      method: 'facade_ledger',
    });
    expect(result?.method).toBe('fascia_under_gutter');
  });

  it('drops host when its fields are malformed', () => {
    const result = normalizePergolaAttachment({
      spatialKind: 'wall',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'wall',
        edgeId: 'wall-1',
        // myEdgeIndex omitted — invalid host
      } as never,
      method: 'facade_ledger',
    });
    expect(result?.host).toBeNull();
    expect(result?.spatialKind).toBe('wall');
  });
});

describe('normalizeObjectFirstPergolaDraft — attachment field', () => {
  // Round-trip: a draft with attachment data flows through normalizer
  // unchanged. A draft without attachment doesn't gain a phantom attachment
  // field (so JSON-equality with baselines stays clean).

  it('preserves attachment data through normalization', () => {
    const attachment: PergolaAttachment = {
      spatialKind: 'roof_edge',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-main',
        edgeKind: 'roof_eave',
        edgeId: 'roof-eave-edge-1',
        myEdgeIndex: 2,
      },
      method: 'fascia_under_gutter',
    };
    const draft = normalizeObjectFirstPergolaDraft({
      id: 'pergola-1',
      label: 'Pergola 1',
      family: 'mono',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: null,
      attachment,
    });
    expect(draft?.attachment).toEqual(attachment);
  });

  it('omits the attachment key entirely when input has none', () => {
    const draft = normalizeObjectFirstPergolaDraft({
      id: 'pergola-1',
      label: 'Pergola 1',
      family: 'mono',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: null,
    });
    expect(draft).toBeDefined();
    expect('attachment' in (draft ?? {})).toBe(false);
  });

  it('omits attachment when input has it but malformed (rather than returning null draft)', () => {
    const draft = normalizeObjectFirstPergolaDraft({
      id: 'pergola-1',
      label: 'Pergola 1',
      family: 'mono',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: null,
      attachment: { spatialKind: 'invalid' as never } as never,
    });
    expect(draft).toBeDefined();
    expect('attachment' in (draft ?? {})).toBe(false);
  });
});
