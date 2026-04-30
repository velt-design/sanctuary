import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { makeHouseFirstConflictingLegacyContextFixture } from './houseFirstWorkbenchFixtures';
import { buildHouseFirstWorkbenchProjectModel } from './houseFirstWorkbenchAdapter';

const HOUSE_FOOTPRINT_PRESETS = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
] as const;

const HOUSE_ROOF_FORMS = ['flat', 'mono', 'gable', 'hipped'] as const;
const ATTACHMENT_SIDES = ['rear', 'front', 'left', 'right'] as const;

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
    expect(projectModel.pergolas[0]?.attachment.resolution.status).toBe('ambiguous');
    expect(projectModel.warnings).toHaveLength(1);
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
          hostEdge: 'left',
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
    expect(soffitProject.pergolas[0]?.attachment.houseAttachmentZoneId).not.toBeNull();
    expect(
      soffitProject.house?.attachmentZones.some(
        (zone) => zone.id === soffitProject.pergolas[0]?.attachment.houseAttachmentZoneId,
      ),
    ).toBe(true);

    const fasciaDraft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!fasciaDraft) throw new Error('Expected drawing draft.');
    fasciaDraft.inputs.modules[0]!.houseAttachmentStrategy = 'fascia_under_gutter';
    fasciaDraft.inputs.modules[0]!.houseConnectionType = 'fascia';

    const fasciaProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft: fasciaDraft,
    });
    const fasciaZoneId = fasciaProject.pergolas[0]?.attachment.houseAttachmentZoneId ?? null;
    expect(fasciaZoneId).not.toBeNull();
    const fasciaZone = fasciaProject.house?.derivedEnvelope?.attachmentZones.find((zone) => zone.id === fasciaZoneId) ?? null;
    expect(fasciaZone?.kind).toBe('fascia');
    expect(
      fasciaProject.house?.attachmentZones.some((zone) => zone.id === fasciaZoneId && zone.kind === 'fascia'),
    ).toBe(true);
    expect(
      fasciaProject.house?.derivedEnvelope?.attachmentZones.some(
        (zone) => zone.kind === 'roof_edge' && zone.hostEdgeId === fasciaZone?.hostEdgeId,
      ),
    ).toBe(true);
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
    expect(
      projectModel.house?.attachmentZones.filter((zone) => zone.kind === 'soffit' && zone.side === 'rear').length,
    ).toBeGreaterThan(0);
    const resolvedZoneIds = new Set(
      projectModel.pergolas
        .map((pergola) => pergola.attachment.houseAttachmentZoneId)
        .filter((zoneId): zoneId is string => typeof zoneId === 'string' && zoneId.length > 0),
    );
    expect(resolvedZoneIds.size).toBe(1);
    const sharedZoneId = Array.from(resolvedZoneIds)[0] ?? null;
    expect(
      projectModel.house?.attachmentZones.some((zone) => zone.id === sharedZoneId && zone.kind === 'soffit'),
    ).toBe(true);
  });

  it('prefers saved canonical pergola attachment zones over saved edges and legacy side fallbacks', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      pergolas: [
        {
          id: 'pergola-1',
          attachmentEdgeId: 'footprint-edge-3',
          attachmentZoneId: 'zone-soffit-footprint-edge-4',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.pergolas[0]?.attachment).toMatchObject({
      attachmentEdgeId: 'footprint-edge-4',
      attachmentZoneId: 'zone-soffit-footprint-edge-4',
      houseAttachmentZoneId: 'zone-soffit-footprint-edge-4',
      side: 'left',
      resolution: {
        status: 'resolved',
        message: null,
      },
    });
    expect(projectModel.warnings).toEqual([]);
  });

  it('keeps stale saved pergola attachment zones unresolved instead of silently retargeting them', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      pergolas: [
        {
          id: 'pergola-1',
          attachmentEdgeId: 'footprint-edge-3',
          attachmentZoneId: 'zone-soffit-footprint-edge-99',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.pergolas[0]?.attachment).toMatchObject({
      attachmentEdgeId: 'footprint-edge-3',
      attachmentZoneId: 'zone-soffit-footprint-edge-99',
      houseAttachmentZoneId: null,
      side: 'rear',
      resolution: {
        status: 'unresolved',
        message:
          'The saved soffit host zone for this pergola is no longer available. Select a new host zone.',
      },
    });
    expect(projectModel.warnings).toContainEqual(
      expect.objectContaining({
        code: 'invalid_house_attachment_zone_overlay',
        field: 'houseFirst.pergolas.pergola-1.attachmentZoneId',
      }),
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

    const expectedControls = {
      flat: {
        pitch: false,
        material: true,
        primaryFallDirection: false,
        ridgeAxis: false,
        appendage: false,
      },
      mono: {
        pitch: true,
        material: true,
        primaryFallDirection: true,
        ridgeAxis: false,
        appendage: true,
      },
      gable: {
        pitch: true,
        material: true,
        primaryFallDirection: false,
        ridgeAxis: true,
        appendage: true,
      },
      hipped: {
        pitch: true,
        material: true,
        primaryFallDirection: false,
        ridgeAxis: true,
        appendage: false,
      },
    } as const;

    for (const [form, controls] of Object.entries(expectedControls)) {
      const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
      if (!draft) throw new Error('Expected drawing draft.');
      draft.houseFirst = {
        roof: {
          form: form as keyof typeof expectedControls,
        },
      };

      const projectModel = buildHouseFirstWorkbenchProjectModel({
        snapshot: monoFixture.snapshot,
        draft,
      });

      expect(projectModel.house?.roof.capabilities.controls).toEqual(controls);
      expect(projectModel.house?.roof.capabilities.footprintTopology).toBe('rectangular');
      expect(projectModel.house?.roof.capabilities.selectedFormSupported).toBe(true);
    }
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
    expect(projectModel.house?.roof.capabilities.controls.ridgeAxis).toBe(true);
    expect(projectModel.house?.roof.capabilities.controls.appendage).toBe(false);
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

  it('treats every preset and live roof form as supported in the shared house model', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');

    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      for (const form of HOUSE_ROOF_FORMS) {
        const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
        if (!draft) throw new Error('Expected drawing draft.');
        draft.inputs.modules[0]!.houseFootprintPreset = preset;
        draft.houseFirst = {
          roof: {
            form,
            primaryPitchDeg: form === 'flat' ? '0' : '18',
            material: 'corrugated_iron',
            primaryFallDirection: 'negative_y',
            ridgeAxis: 'x',
          },
        };

        const projectModel = buildHouseFirstWorkbenchProjectModel({
          snapshot: monoFixture.snapshot,
          draft,
        });

        expect(projectModel.house?.footprint.preset, `${preset}/${form} footprint`).toBe(preset);
        expect(projectModel.house?.roof.form, `${preset}/${form} form`).toBe(form);
        expect(projectModel.house?.roof.geometryKind, `${preset}/${form} geometry`).not.toBeNull();
        expect(projectModel.house?.roof.capabilities.selectedFormSupported, `${preset}/${form} supported`).toBe(
          true,
        );
        expect(projectModel.house?.roof.validation.code, `${preset}/${form} validation code`).toBeNull();
        expect(projectModel.house?.roof.validation.status, `${preset}/${form} validation status`).not.toBe(
          'invalid',
        );
      }
    }
  });

  it('keeps gable and hipped preset roofs supported across attachment-side rotations', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');

    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        for (const form of ['gable', 'hipped'] as const) {
          const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
          if (!draft) throw new Error('Expected drawing draft.');
          draft.inputs.modules[0]!.attachmentSide = attachmentSide;
          draft.inputs.modules[0]!.houseFootprintPreset = preset;
          draft.houseFirst = {
            roof: {
              form,
              primaryPitchDeg: '18',
              material: 'corrugated_iron',
            },
          };

          const projectModel = buildHouseFirstWorkbenchProjectModel({
            snapshot: monoFixture.snapshot,
            draft,
          });

          expect(projectModel.house?.footprint.preset, `${preset}/${attachmentSide}/${form} footprint`).toBe(
            preset,
          );
          expect(projectModel.house?.footprint.attachmentSide, `${preset}/${attachmentSide}/${form} side`).toBe(
            attachmentSide,
          );
          expect(projectModel.house?.roof.form, `${preset}/${attachmentSide}/${form} form`).toBe(form);
          expect(projectModel.house?.roof.geometryKind, `${preset}/${attachmentSide}/${form} geometry`).not.toBeNull();
          expect(
            projectModel.house?.roof.capabilities.selectedFormSupported,
            `${preset}/${attachmentSide}/${form} supported`,
          ).toBe(true);
          expect(projectModel.house?.roof.validation.code, `${preset}/${attachmentSide}/${form} code`).toBeNull();
          expect(projectModel.house?.roof.validation.status, `${preset}/${attachmentSide}/${form} status`).not.toBe(
            'invalid',
          );
        }
      }
    }
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
        form: 'gable',
        ridgeAxis: 'x',
        appendage: {
          enabled: true,
          hostEdge: 'front',
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
    expect(projectModel.house?.roof.validation.code).toBe('invalid_appendage_topology');
    expect(projectModel.house?.roof.appendageSupportedHostEdges).toEqual([]);
    expect(projectModel.house?.roof.appendageSupportReason).toContain('Appendage bands require at least one continuous exterior perimeter run');
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

  it('preserves custom deck outlines and keeps oversized attached preset width and offset intact', () => {
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
      widthM: '12',
      depthM: '2',
      centerOffsetM: '999',
      detachedGapM: null,
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '996', depthM: '-2' },
      { alongM: '1008', depthM: '-2' },
      { alongM: '1008', depthM: '0' },
      { alongM: '996', depthM: '0' },
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

  it('keeps oversized attached preset decks anchored to the selected exact custom-footprint wall segment', () => {
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
      widthM: '12',
      depthM: '2.2',
      centerOffsetM: '999',
      detachedGapM: null,
    });
    expect(projectModel.house?.decks[0]?.outline).toEqual([
      { alongM: '996', depthM: '-2.2' },
      { alongM: '1008', depthM: '-2.2' },
      { alongM: '1008', depthM: '0' },
      { alongM: '996', depthM: '0' },
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

  it('builds stable derived wall graphs for straight, custom, and multi-segment same-side footprints', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    const screenshotFixture = getSanctuaryGeometryWorkbenchFixture('gable-u-hipped-screenshot');
    if (!monoFixture || !screenshotFixture) {
      throw new Error('Missing Sanctuary workbench fixtures.');
    }

    const straightProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
    });
    expect(straightProject.house?.derivedWallGraph.walls.map((wall) => ({
      id: wall.id,
      label: wall.label,
      edgeIds: wall.edgeIds,
    }))).toEqual([
      { id: 'wall-footprint-edge-1', label: 'Front wall', edgeIds: ['footprint-edge-1'] },
      { id: 'wall-footprint-edge-2', label: 'Right wall', edgeIds: ['footprint-edge-2'] },
      { id: 'wall-footprint-edge-3', label: 'Rear wall', edgeIds: ['footprint-edge-3'] },
      { id: 'wall-footprint-edge-4', label: 'Left wall', edgeIds: ['footprint-edge-4'] },
    ]);

    const customDraft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!customDraft) throw new Error('Expected drawing draft.');
    customDraft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    customDraft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '-1.8', depthM: '1.8' },
      { alongM: '9.8', depthM: '1.8' },
      { alongM: '9.8', depthM: '-5' },
      { alongM: '8', depthM: '-5' },
      { alongM: '8', depthM: '0' },
      { alongM: '0', depthM: '0' },
      { alongM: '0', depthM: '-5' },
      { alongM: '-1.8', depthM: '-5' },
    ];

    const customProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft: customDraft,
    });
    expect(
      customProject.house?.derivedWallGraph.walls
        .filter((wall) => wall.label.startsWith('Rear wall'))
        .map((wall) => `${wall.id}:${wall.label}`),
    ).toEqual([
      'wall-footprint-edge-3:Rear wall',
      'wall-footprint-edge-5:Rear wall 2',
      'wall-footprint-edge-7:Rear wall 3',
    ]);

    const screenshotProject = buildHouseFirstWorkbenchProjectModel({
      snapshot: screenshotFixture.snapshot,
      draft: screenshotFixture.draft,
    });
    expect(
      screenshotProject.house?.derivedWallGraph.walls
        .filter((wall) => wall.label.startsWith('Rear wall'))
        .map((wall) => `${wall.id}:${wall.label}`),
    ).toEqual([
      'wall-footprint-edge-3:Rear wall',
      'wall-footprint-edge-5:Rear wall 2',
      'wall-footprint-edge-7:Rear wall 3',
    ]);
  });

  it('prefers hostWallId over exact host edges and legacy side fallbacks when resolving shared openings', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-priority',
          label: 'Priority window',
          kind: 'window',
          hostWallId: 'wall-footprint-edge-3',
          wallId: 'left',
          hostEdgeId: 'footprint-edge-4',
          widthM: '1.8',
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

    expect(projectModel.house?.openings[0]).toMatchObject({
      hostWallId: 'wall-footprint-edge-3',
      wallId: 'rear',
      hostEdgeId: 'footprint-edge-3',
      validation: {
        status: 'valid',
        codes: [],
        message: null,
      },
    });
  });

  it('prefers exact host edges over legacy side fallbacks when canonical hostWallId is absent', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-exact-edge',
          label: 'Exact edge window',
          kind: 'window',
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-4',
          widthM: '0.9',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.3',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: monoFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings[0]).toMatchObject({
      hostWallId: 'wall-footprint-edge-4',
      wallId: 'left',
      hostEdgeId: 'footprint-edge-4',
      validation: {
        status: 'valid',
        codes: [],
        message: null,
      },
    });
  });

  it('marks side-only opening hosts ambiguous when the selected side has multiple derived wall segments', () => {
    const screenshotFixture = getSanctuaryGeometryWorkbenchFixture('gable-u-hipped-screenshot');
    if (!screenshotFixture) throw new Error('Missing gable-u-hipped-screenshot fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(screenshotFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-ambiguous',
          label: 'Ambiguous window',
          kind: 'window',
          wallId: 'rear',
          widthM: '1.2',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.2',
        },
      ],
    };

    const projectModel = buildHouseFirstWorkbenchProjectModel({
      snapshot: screenshotFixture.snapshot,
      draft,
    });

    expect(projectModel.house?.openings[0]).toMatchObject({
      hostWallId: null,
      wallId: 'rear',
      hostEdgeId: null,
      validation: {
        status: 'invalid',
        codes: ['ambiguous_host_wall'],
        message: 'Select a specific derived host wall because this side has multiple wall segments.',
      },
    });
  });

  it('keeps stale saved hostWallIds unresolved instead of silently retargeting openings', () => {
    const monoFixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!monoFixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(monoFixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
      openings: [
        {
          id: 'opening-stale-wall',
          label: 'Stale host wall window',
          kind: 'window',
          hostWallId: 'wall-footprint-edge-99',
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-3',
          widthM: '1.8',
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

    expect(projectModel.house?.openings[0]).toMatchObject({
      hostWallId: 'wall-footprint-edge-99',
      wallId: 'rear',
      hostEdgeId: 'footprint-edge-3',
      validation: {
        status: 'invalid',
        codes: ['missing_host_wall'],
        message: 'This opening no longer has a valid derived host wall. Select a new host wall before placing it.',
      },
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
