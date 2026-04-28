import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { makeHouseFirstConflictingLegacyContextFixture } from './houseFirstWorkbenchFixtures';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';

describe('buildHouseFirstWorkbenchProjectModel', () => {
  it('classifies mono, gable, and box legacy fixtures into first-pass roof forms', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    const gableFixture = getSanctuaryGeometryWorkbenchFixture('gable-standard');
    const boxFixture = getSanctuaryGeometryWorkbenchFixture('box-standard');
    if (!monoFixture || !gableFixture || !boxFixture) {
      throw new Error('Missing Sanctuary workbench fixtures.');
    }

    expect(buildHouseFirstWorkbenchProjectModel({ snapshot: monoFixture.snapshot }).house?.roof.form).toBe('mono');
    expect(buildHouseFirstWorkbenchProjectModel({ snapshot: gableFixture.snapshot }).house?.roof.form).toBe('gable');
    expect(buildHouseFirstWorkbenchProjectModel({ snapshot: boxFixture.snapshot }).house?.roof.form).toBe('flat');
  });

  it('derives pergolas and shared house state from a local drawing draft', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'wrap_left';

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.footprint.preset).toBe('wrap_left');
    expect(projectModel.pergolas).toHaveLength(1);
    expect(projectModel.warnings).toHaveLength(0);
  });

  it('lets the shared roof draft override legacy roof inference', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '5', depthM: '0' },
      { alongM: '5', depthM: '8' },
      { alongM: '0', depthM: '8' },
    ];
    draft.houseFirst = {
      roof: {
        form: 'gable',
        primaryPitchDeg: '18',
        primaryFallDirection: 'negative_x',
        ridgeAxis: 'y',
        appendage: {
          enabled: true,
          hostEdge: 'rear',
          pitchDeg: '5',
          dropMm: '600',
        },
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.form).toBe('gable');
    expect(projectModel.house?.roof.primaryPitchDeg).toBe('18');
    expect(projectModel.house?.roof.primaryFallDirection).toBe('negative_x');
    expect(projectModel.house?.roof.ridgeAxis).toBe('y');
    expect(projectModel.house?.roof.appendage.enabled).toBe(true);
    expect(projectModel.house?.roof.validation.status).toBe('valid');
    expect(projectModel.house?.roof.validation.approximationReasons).toEqual([]);
    expect(projectModel.house?.roof.provenance).toMatchObject({
      form: 'house_first_draft',
      primaryPitchDeg: 'house_first_draft',
      primaryFallDirection: 'house_first_draft',
      ridgeAxis: 'house_first_draft',
      appendage: 'house_first_draft',
    });
    expect(projectModel.house?.roof.source).toBe('house_first_draft');
  });

  it('derives shared soffit and fascia attachment zones from shared house context', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');

    const soffitProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
    });
    expect(soffitProject.house?.attachmentZones.some((zone) => zone.id === 'zone-soffit-rear')).toBe(true);
    expect(soffitProject.pergolas[0]?.attachment.houseAttachmentZoneId).toBe('zone-soffit-rear');

    const fasciaDraft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!fasciaDraft) throw new Error('Expected drawing draft.');
    fasciaDraft.inputs.modules[0]!.houseAttachmentStrategy = 'fascia_under_gutter';
    fasciaDraft.inputs.modules[0]!.houseConnectionType = 'fascia';

    const fasciaProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft: fasciaDraft,
    });
    expect(fasciaProject.house?.attachmentZones.some((zone) => zone.id === 'zone-fascia-rear')).toBe(true);
    expect(fasciaProject.house?.attachmentZones.some((zone) => zone.id === 'zone-roof_edge-rear')).toBe(true);
    expect(fasciaProject.pergolas[0]?.attachment.houseAttachmentZoneId).toBe('zone-fascia-rear');
  });

  it('recomputes shared attachment zones when the roof state becomes blocked', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '-1.8' },
      { alongM: '6', depthM: '-1.8' },
      { alongM: '4.2', depthM: '0.6' },
      { alongM: '0', depthM: '0' },
    ];

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.validation.status).toBe('invalid');
    expect(projectModel.house?.attachmentZones.some((zone) => zone.side === 'rear' && zone.kind === 'soffit')).toBe(false);
    expect(projectModel.house?.attachmentZoneDiagnostics.blocked).toContainEqual({
      side: 'rear',
      kind: 'soffit',
      reason: 'invalid_roof_state',
    });
    expect(projectModel.pergolas[0]?.attachment.houseAttachmentZoneId).toBeNull();
    expect(projectModel.warnings.some((warning) => warning.code === 'invalid_house_attachment_zone_overlay')).toBe(
      true,
    );
  });

  it('suppresses roof-adjacent shared attachment zones when large openings occupy the same side', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-slider-rear',
          kind: 'slider',
          wallId: 'rear',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.8',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.attachmentZones.some((zone) => zone.side === 'rear' && zone.kind === 'soffit')).toBe(
      false,
    );
    expect(projectModel.house?.attachmentZoneDiagnostics.blocked).toContainEqual({
      side: 'rear',
      kind: 'soffit',
      reason: 'side_openings_block_roof_zone',
    });
    expect(projectModel.pergolas[0]?.attachment.houseAttachmentZoneId).toBeNull();
  });

  it('resolves shared attachment zones once for a shared house across multiple pergolas', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const snapshot = structuredClone(monoFixture.snapshot) as {
      inputs?: {
        pergolas?: Array<{ id: string; label: string }>;
        modules?: Array<Record<string, unknown>>;
      };
      outputs?: {
        pergolas?: Array<{ id: string; modules: Array<Record<string, unknown>> }>;
      };
    };
    if (!snapshot.inputs?.modules?.[0]) {
      throw new Error('Expected fixture snapshot module.');
    }
    snapshot.inputs.pergolas = [
      { id: 'pergola-1', label: 'Pergola 1' },
      { id: 'pergola-2', label: 'Pergola 2' },
    ];
    snapshot.inputs.modules = [
      structuredClone(snapshot.inputs.modules[0]),
      {
        ...structuredClone(snapshot.inputs.modules[0]),
        pergolaId: 'pergola-2',
        lengthM: '4.5',
        projectionM: '2.5',
      },
    ];

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: snapshot as Record<string, unknown>,
    });

    expect(projectModel.pergolas).toHaveLength(2);
    expect(projectModel.house?.attachmentZones.filter((zone) => zone.id === 'zone-soffit-rear')).toHaveLength(1);
    expect(new Set(projectModel.pergolas.map((pergola) => pergola.attachment.houseAttachmentZoneId))).toEqual(
      new Set(['zone-soffit-rear']),
    );
  });

  it('marks inferred mono roofs as approximate and records roof provenance', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
    });

    expect(projectModel.house?.roof.form).toBe('mono');
    expect(projectModel.house?.roof.validation.status).toBe('approximate');
    expect(projectModel.house?.roof.validation.approximationReasons).toEqual(['inferred_form']);
    expect(projectModel.house?.roof.primaryFallDirection).toBe('negative_y');
    expect(projectModel.house?.roof.provenance).toMatchObject({
      form: 'legacy_pergola_inference',
      material: 'legacy_shared_value',
      primaryPitchDeg: 'default_fallback',
      primaryFallDirection: 'default_fallback',
      ridgeAxis: 'default_fallback',
      openGableEndIds: 'default_fallback',
      appendage: 'default_fallback',
    });
  });

  it('keeps coherent explicit mono fall directions valid and blocks incoherent drain-back directions', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');

    draft.houseFirst = {
      roof: {
        form: 'mono',
        primaryFallDirection: 'negative_y',
      },
    };
    const coherentProjectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(coherentProjectModel.house?.roof.validation.status).toBe('valid');
    expect(coherentProjectModel.house?.roof.validation.code).toBeNull();

    draft.houseFirst.roof!.primaryFallDirection = 'positive_y';
    const incoherentProjectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(incoherentProjectModel.house?.roof.validation.status).toBe('invalid');
    expect(incoherentProjectModel.house?.roof.validation.code).toBe('invalid_mono_fall_direction');
  });

  it('derives form-aware roof capabilities from the shared house footprint', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      roof: {
        form: 'gable',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.capabilities.controls.primaryFallDirection).toBe(false);
    expect(projectModel.house?.roof.capabilities.controls.ridgeAxis).toBe(true);
    expect(projectModel.house?.roof.capabilities.footprintTopology).toBe('rectangular');
    expect(projectModel.house?.roof.capabilities.selectedFormSupported).toBe(true);
    expect(projectModel.house?.roof.capabilities.appendageSupported).toBe(true);
  });

  it('updates roof validation and capabilities when the footprint topology becomes orthogonally supported', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.houseFirst = {
      roof: {
        form: 'gable',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.capabilities.footprintTopology).toBe('orthogonal');
    expect(projectModel.house?.roof.capabilities.selectedFormSupported).toBe(true);
    expect(projectModel.house?.roof.validation.code).toBeNull();
    expect(projectModel.house?.roof.validation.message).toBeNull();
    expect(projectModel.house?.roof.validation.status).toBe('valid');
    expect(projectModel.house?.roof.ridgeAxis).toBe('x');
    expect(projectModel.house?.roof.provenance?.ridgeAxis).toBe('default_fallback');
    expect(projectModel.house?.roof.geometryKind).toBe('bent_spine_joined_gable');
  });

  it('keeps orthogonal hipped footprints valid and exposes joined-hipped geometry', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.houseFirst = {
      roof: {
        form: 'hipped',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.validation.status).toBe('valid');
    expect(projectModel.house?.roof.validation.code).toBeNull();
    expect(projectModel.house?.roof.geometryKind).toBe('rectilinear_joined_hipped');
  });

  it('filters invalid saved open gable ends when the ridge orientation changes', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '5', depthM: '0' },
      { alongM: '5', depthM: '8' },
      { alongM: '0', depthM: '8' },
    ];
    draft.houseFirst = {
      roof: {
        form: 'gable',
        ridgeAxis: 'y',
        openGableEndIds: ['house-gable-end-x-2'],
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.openGableEndIds).toEqual([]);
    expect(projectModel.warnings.some((warning) => warning.code === 'invalid_house_first_roof_overlay')).toBe(true);
    expect(projectModel.house?.roof.validation.status).toBe('valid');
    expect(projectModel.house?.roof.validation.approximationReasons).toEqual([]);
  });

  it('marks near-square gable footprints as approximate when the ridge axis is inferred', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '6', depthM: '0' },
      { alongM: '6', depthM: '5.5' },
      { alongM: '0', depthM: '5.5' },
    ];
    draft.houseFirst = {
      roof: {
        form: 'gable',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.validation.status).toBe('approximate');
    expect(projectModel.house?.roof.validation.approximationReasons).toEqual([
      'inferred_ridge_axis',
      'ambiguous_ridge_axis',
    ]);
    expect(projectModel.house?.roof.provenance?.ridgeAxis).toBe('default_fallback');
  });

  it('blocks explicit ridge axes that do not match the current footprint span/topology', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      roof: {
        form: 'gable',
        ridgeAxis: 'y',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.validation.status).toBe('invalid');
    expect(projectModel.house?.roof.validation.code).toBe('invalid_ridge_axis');
  });

  it('surfaces only the outer open-end options for U-shaped bent gables', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.houseFirst = {
      roof: {
        form: 'gable',
        ridgeAxis: 'x',
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.terminalEnds).toHaveLength(2);
    expect(projectModel.house?.roof.terminalEnds.map((end) => end.sourceEdgeId)).toEqual([
      'footprint-edge-7',
      'footprint-edge-3',
    ]);
  });

  it('accepts orthogonal mono presets in shared roof validation', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.form).toBe('mono');
    expect(projectModel.house?.roof.capabilities.footprintTopology).toBe('orthogonal');
    expect(projectModel.house?.roof.capabilities.selectedFormSupported).toBe(true);
    expect(projectModel.house?.roof.validation.code).toBeNull();
    expect(projectModel.house?.roof.validation.message).toBeNull();
  });

  it('accepts custom orthogonal mono outlines and blocks non-orthogonal ones', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '-1.8', depthM: '-1.8' },
      { alongM: '7.8', depthM: '-1.8' },
      { alongM: '7.8', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
      { alongM: '0', depthM: '2.4' },
      { alongM: '-1.8', depthM: '2.4' },
    ];

    const orthogonalProjectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(orthogonalProjectModel.house?.roof.capabilities.footprintTopology).toBe('orthogonal');
    expect(orthogonalProjectModel.house?.roof.validation.code).toBeNull();

    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '-1.8' },
      { alongM: '6', depthM: '-1.8' },
      { alongM: '4.2', depthM: '0.6' },
      { alongM: '0', depthM: '0' },
    ];

    const polygonalProjectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(polygonalProjectModel.house?.roof.capabilities.footprintTopology).toBe('polygonal');
    expect(polygonalProjectModel.house?.roof.validation.code).toBe('unsupported_roof_topology');
    expect(polygonalProjectModel.house?.roof.validation.message).toBe(
      'Mono roofs are currently limited to orthogonal house footprints in this milestone.',
    );
  });

  it('uses the first populated module when legacy house values conflict and emits a blocking warning', () => {
    const fixture = makeHouseFirstConflictingLegacyContextFixture();

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
    });

    expect(projectModel.house?.footprint.preset).toBe('straight');
    expect(projectModel.house?.lowConfidence).toBe(true);
    expect(projectModel.warnings.length).toBeGreaterThan(0);
    expect(projectModel.warnings[0]?.severity).toBe('blocking');
    expect(projectModel.warnings[0]?.chosenModuleIndex).toBe(0);
  });

  it('rebuilds preset deck outlines from presetRect params and backfills missing presetRect data', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Deck 1',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '4',
            depthM: '2.5',
            centerOffsetM: '1',
          },
          outline: [
            { alongM: '0', depthM: '0' },
            { alongM: '8', depthM: '0' },
            { alongM: '8', depthM: '2' },
            { alongM: '0', depthM: '2' },
          ],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
        {
          id: 'deck-2',
          name: 'Deck 2',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_detached',
          outline: [
            { alongM: '2.2', depthM: '-3.6' },
            { alongM: '5.8', depthM: '-3.6' },
            { alongM: '5.8', depthM: '-0.6' },
            { alongM: '2.2', depthM: '-0.6' },
          ],
          elevationMode: 'ground',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: false,
          surfaceMaterial: 'composite',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.decks[0]?.presetRect).toEqual({
      widthM: '4',
      depthM: '2.5',
      centerOffsetM: '1',
      detachedGapM: null,
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '2', depthM: '-2.5' },
      { alongM: '6', depthM: '-2.5' },
      { alongM: '6', depthM: '0' },
      { alongM: '2', depthM: '0' },
    ]);
    expect(projectModel.house?.decks[1]?.presetRect).toEqual({
      widthM: '3.6',
      depthM: '3',
      centerOffsetM: '1',
      detachedGapM: '0.6',
    });
    expect(projectModel.house?.decks[1]?.floatingRect).toEqual({
      centerAlongM: '4',
      centerDepthM: '-2.1',
      widthM: '3.6',
      depthM: '3',
    });
  });

  it('surfaces supported appendage host edges and blocks unsupported ones', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.houseFirst = {
      roof: {
        appendage: {
          enabled: true,
          hostEdge: 'rear',
          pitchDeg: '5',
          dropMm: '450',
        },
      },
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.roof.validation.status).toBe('invalid');
    expect(projectModel.house?.roof.validation.code).toBe('invalid_appendage_host_edge');
    expect(projectModel.house?.roof.appendageSupportedHostEdges).toEqual(['front', 'left', 'right']);
    expect(projectModel.house?.roof.appendageSupportReason).toContain('Supported edges: Front, Left, Right');
  });

  it('uses floating preset rects as detached preset geometry without discarding legacy preset fields', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      decks: [
        {
          id: 'deck-floating',
          name: 'Floating deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_detached',
          presetRect: {
            widthM: '3.6',
            depthM: '3',
            centerOffsetM: '0.4',
            detachedGapM: '0.6',
          },
          floatingRect: {
            centerAlongM: '8',
            centerDepthM: '5',
            widthM: '4',
            depthM: '2',
          },
          elevationMode: 'ground',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: false,
          surfaceMaterial: 'composite',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.decks[0]?.presetRect).toEqual({
      widthM: '3.6',
      depthM: '3',
      centerOffsetM: '0.4',
      detachedGapM: '0.6',
    });
    expect(projectModel.house?.decks[0]?.floatingRect).toEqual({
      centerAlongM: '8',
      centerDepthM: '5',
      widthM: '4',
      depthM: '2',
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '6', depthM: '4' },
      { alongM: '10', depthM: '4' },
      { alongM: '10', depthM: '6' },
      { alongM: '6', depthM: '6' },
    ]);
  });

  it('preserves custom deck outlines and clamps attached preset width to the host edge length', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Deck 1',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '12',
            depthM: '2',
            centerOffsetM: '999',
          },
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
        {
          id: 'deck-2',
          name: 'Deck 2',
          kind: 'deck',
          shape: 'custom',
          outline: [
            { alongM: '7', depthM: '-1' },
            { alongM: '9', depthM: '-1' },
            { alongM: '8.5', depthM: '-3' },
          ],
          elevationMode: 'ground',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: false,
          surfaceMaterial: 'composite',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.decks[0]?.presetRect).toEqual({
      widthM: '6',
      depthM: '2',
      centerOffsetM: '0',
      detachedGapM: null,
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '0', depthM: '-2' },
      { alongM: '6', depthM: '-2' },
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ]);
    expect(projectModel.house?.decks[1]?.outline).toEqual([
      { alongM: '7', depthM: '-1' },
      { alongM: '9', depthM: '-1' },
      { alongM: '8.5', depthM: '-3' },
    ]);
  });

  it('attaches preset decks to the rendered house edge when footprint offset and setback are set', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'straight';
    draft.inputs.modules[0]!.houseFootprintParams = {
      ...draft.inputs.modules[0]!.houseFootprintParams,
      widthM: '6',
      offsetXM: '1.25',
      setbackM: '0.75',
      bandDepthM: '1.8',
    };
    draft.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Deck 1',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '6',
            depthM: '2',
            centerOffsetM: '0',
          },
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '1.25', depthM: '-1.25' },
      { alongM: '7.25', depthM: '-1.25' },
      { alongM: '7.25', depthM: '0.75' },
      { alongM: '1.25', depthM: '0.75' },
    ]);
    expect(projectModel.house?.decks[0]?.validation.status).toBe('valid');
  });

  it('keeps attached preset decks outside custom house footprints when the selected host edge has multiple segments', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    draft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '2', depthM: '0' },
      { alongM: '2', depthM: '4' },
      { alongM: '4', depthM: '4' },
      { alongM: '4', depthM: '0' },
      { alongM: '6', depthM: '0' },
      { alongM: '6', depthM: '6' },
      { alongM: '0', depthM: '6' },
    ];
    draft.houseFirst = {
      decks: [
        {
          id: 'deck-1',
          name: 'Deck 1',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: {
            widthM: '12',
            depthM: '2.2',
            centerOffsetM: '999',
          },
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          hostEdgeId: 'rear',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.decks[0]?.presetRect).toEqual({
      widthM: '2',
      depthM: '2.2',
      centerOffsetM: '0',
      detachedGapM: null,
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '0', depthM: '-2.2' },
      { alongM: '2', depthM: '-2.2' },
      { alongM: '2', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ]);
    expect(projectModel.house?.decks[0]?.validation.status).toBe('valid');
  });

  it('builds shared openings from opening drafts and validates overlaps on the same wall', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-1',
          label: 'Window 1',
          kind: 'window',
          wallId: 'rear',
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.4',
        },
        {
          id: 'opening-2',
          label: 'Window 2',
          kind: 'window',
          wallId: 'rear',
          widthM: '1.8',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '1.2',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings[0]).toMatchObject({
      id: 'opening-1',
      wallId: 'rear',
      hostEdgeId: 'footprint-edge-3',
      validation: {
        status: 'valid',
        message: null,
      },
    });
    expect(projectModel.house?.openings[1]?.validation).toMatchObject({
      status: 'invalid',
      codes: ['overlapping_openings'],
      message: 'Openings on the same wall cannot overlap.',
    });
  });

  it('preserves supported opening kinds and defaults unknown kinds to window', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-slider',
          label: 'Slider',
          kind: 'slider',
          panelCount: 3,
          wallId: 'rear',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.5',
        },
        {
          id: 'opening-door',
          label: 'Door',
          kind: 'hinged_door',
          wallId: 'left',
          widthM: '0.9',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.3',
        },
        {
          id: 'opening-fallback',
          label: 'Fallback',
          kind: 'unknown_family' as any,
          wallId: 'front',
          widthM: '1.2',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.4',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings.map((opening) => opening.kind)).toEqual([
      'slider',
      'hinged_door',
      'window',
    ]);
    expect(projectModel.house?.openings[0]?.panelCount).toBe(3);
    expect(projectModel.house?.openings[1]?.panelCount).toBeNull();
    expect(projectModel.house?.openings[2]?.panelCount).toBeNull();
  });

  it('enforces simple slider corner clearance while leaving window validation shared', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-slider-clearance',
          label: 'Corner slider',
          kind: 'slider',
          panelCount: 2,
          wallId: 'rear',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.1',
        },
        {
          id: 'opening-window-clearance',
          label: 'Corner window',
          kind: 'window',
          wallId: 'rear',
          widthM: '1.2',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.1',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings[0]?.validation).toMatchObject({
      status: 'invalid',
      codes: ['insufficient_corner_clearance'],
      message: 'Sliders and stackers need at least 0.3m clearance from each wall corner.',
    });
    expect(projectModel.house?.openings[1]?.validation.status).toBe('valid');
  });

  it('applies the same corner-clearance rule to stackers while keeping doors on shared wall-fit rules', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-stacker-clearance',
          label: 'Corner stacker',
          kind: 'stacker',
          wallId: 'rear',
          widthM: '3.6',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.1',
        },
        {
          id: 'opening-door-valid',
          label: 'Rear door',
          kind: 'hinged_door',
          wallId: 'rear',
          widthM: '0.9',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '4.8',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings[0]?.validation).toMatchObject({
      status: 'invalid',
      codes: ['insufficient_corner_clearance'],
      message: 'Sliders and stackers need at least 0.3m clearance from each wall corner.',
    });
    expect(projectModel.house?.openings[1]?.validation).toMatchObject({
      status: 'valid',
      message: null,
    });
  });
});
