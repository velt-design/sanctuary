import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { AttachmentSide, HouseFootprintPreset, HouseRoofForm } from '@sp/geometry';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildObjectWorkbenchCompatibilityProjectModel,
  type ObjectWorkbenchCompatibilityDraft,
} from '@/lib/drawings/state/compat/objectWorkbenchCompatibilityModel';
import { makeHouseFirstDeckSupportProjectFixture } from '@/lib/drawings/state/houseFirstWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import {
  buildObjectFirstDeckDraftsFromCompatibilityDrafts,
  buildObjectFirstOpeningDraftsFromCompatibilityDrafts,
  buildObjectFirstWorkbenchProjectModel,
} from '@/lib/drawings/state/legacyObjectFirstCompatibilityAdapter';
import { buildObjectWorkbenchGeometryContext } from './objectWorkbenchGeometryContext';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

const HOUSE_FOOTPRINT_PRESETS: readonly HouseFootprintPreset[] = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
];

const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ['flat', 'mono', 'gable', 'hipped'];
const ATTACHMENT_SIDES: readonly AttachmentSide[] = ['rear', 'front', 'left', 'right'];

function applyObjectFirstCompatibilityDraft(input: {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
  compatibility: ObjectWorkbenchCompatibilityDraft;
}) {
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({ snapshot: input.snapshot });
  const objectFirstProjectModel = buildObjectFirstWorkbenchProjectModel({ compatibilityProjectModel });
  const objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(objectFirstProjectModel);
  const houseForm = objectFirst.houseAssembly?.houseForms[0] ?? null;
  if (input.compatibility.roof && houseForm) {
    const roof = input.compatibility.roof;
    houseForm.roofIntentAuthored = true;
    houseForm.roofIntent = {
      ...houseForm.roofIntent,
      ...(roof.form ? { form: roof.form } : null),
      ...(roof.material ? { material: roof.material } : null),
      ...(roof.primaryPitchDeg !== undefined && roof.primaryPitchDeg !== null
        ? { primaryPitchDeg: roof.primaryPitchDeg }
        : null),
      ...(roof.primaryFallDirection ? { primaryFallDirection: roof.primaryFallDirection } : null),
      ...(roof.ridgeAxis ? { ridgeAxis: roof.ridgeAxis } : null),
      ...(roof.openGableEndIds ? { openGableEndIds: roof.openGableEndIds } : null),
      appendage: {
        ...houseForm.roofIntent.appendage,
        ...(roof.appendage?.enabled !== undefined && roof.appendage.enabled !== null
          ? { enabled: roof.appendage.enabled }
          : null),
        ...(roof.appendage?.form ? { form: roof.appendage.form } : null),
        ...(roof.appendage?.hostEdge ? { hostEdge: roof.appendage.hostEdge } : null),
        ...(roof.appendage?.pitchDeg !== undefined && roof.appendage.pitchDeg !== null
          ? { pitchDeg: roof.appendage.pitchDeg }
          : null),
        ...(roof.appendage?.dropMm !== undefined && roof.appendage.dropMm !== null
          ? { dropMm: roof.appendage.dropMm }
          : null),
      },
    };
  }
  if (input.compatibility.decks) {
    objectFirst.decks = buildObjectFirstDeckDraftsFromCompatibilityDrafts(input.compatibility.decks);
  }
  if (input.compatibility.openings) {
    objectFirst.openings = buildObjectFirstOpeningDraftsFromCompatibilityDrafts(
      input.compatibility.openings,
      houseForm?.id ?? null,
    );
  }
  input.draft.objectFirst = objectFirst;
}

function buildGeometryContextFromObjectFirstDraft(input: {
  snapshot: Record<string, unknown>;
  draft?: EstimateDrawingDraft | null;
}) {
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
    snapshot: input.snapshot,
    draft: input.draft,
  });
  const projectModel = buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
    objectFirstDraft: input.draft?.objectFirst,
  });
  return buildObjectWorkbenchGeometryContext({
    snapshot: input.snapshot,
    draft: input.draft,
    projectModel,
  });
}

function buildGeometryContextFromCompatibilityProjectModel(
  compatibilityProjectModel: Parameters<typeof buildObjectFirstWorkbenchProjectModel>[0]['compatibilityProjectModel'],
) {
  return buildObjectWorkbenchGeometryContext({
    projectModel: buildObjectFirstWorkbenchProjectModel({ compatibilityProjectModel }),
  });
}

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '5',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    postCount: '2',
    houseConnectionType: 'soffit',
    attachmentSide: 'left',
    drawingRotationQuarterTurns: 0,
    houseFootprintPreset: 'l_left',
    houseFootprintParams: {
      widthM: '',
      offsetXM: '0',
      setbackM: '0',
      bandDepthM: '1.8',
      returnRunM: '2.4',
      recessWidthM: '2.4',
      recessDepthM: '1.2',
      leftLegRunM: '2.4',
      rightLegRunM: '2.4',
      sideRunM: '2.4',
    },
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
    ...overrides,
  };
}

function makeResult(overrides: Partial<CostOutputV1['derived']> = {}): CostOutputV1 {
  return {
    inputs_normalized: {} as CostOutputV1['inputs_normalized'],
    derived: {
      length_m: 6.4,
      projection_m: 3.2,
      roof_pitch_deg_used: 7,
      slope_direction: 'toward_house',
      ...overrides,
    } as CostOutputV1['derived'],
    materials: {} as CostOutputV1['materials'],
    install: {} as CostOutputV1['install'],
    overhead: {} as CostOutputV1['overhead'],
    add_ons: {} as CostOutputV1['add_ons'],
    totals: {} as CostOutputV1['totals'],
  };
}

describe('buildRawGeometryModuleInput', () => {
  it('maps mono calculator data into the raw geometry package contract with derived overrides', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      designRequestId: 'dpr_1',
      moduleId: 'mod_1',
      module: makeModule(),
      result: makeResult(),
    });

    expect(raw).toEqual({
      projectId: 'proj_1',
      estimateId: 'est_1',
      designRequestId: 'dpr_1',
      moduleId: 'mod_1',
      pergolaStyle: 'pitched',
      boxPerimeterEnabled: false,
      roof: {
        material: 'acrylic',
        mode: null,
        slopeDirection: 'away_from_house',
        roofPitchDeg: '5',
        overhangEnabled: false,
        overhangM: 0,
        mixedAcrylicBaysMain: '0',
        mixedAcrylicBaysA: '0',
        mixedAcrylicBaysB: '0',
      },
      gable: {
        endFramesMode: 'outer_end_only',
        houseEaveGutter: 'house',
        outerEaveGutter: 'our',
      },
      box: {
        houseEdgeGutter: 'house',
        farEdgeGutter: 'our',
      },
      connection: {
        houseConnectionType: 'soffit',
        attachmentSide: 'left',
      },
      supports: expect.objectContaining({
        postCount: '2',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      }),
      structural: {
        heights: {
          houseUndersideM: '2.4',
          outerUndersideM: 2.768,
          referenceUndersideM: '2.4',
        },
        profiles: {
          post: null,
          rafter: null,
          ledger: null,
          supportBeam: null,
          gutter: null,
          ridge: null,
          tieBeam: '150x50',
          strut: '50x50',
          boxPerimeter: null,
        },
        framing: {
          rafterCount: null,
          rafterSpacingMm: null,
        },
        drainage: {
          gutterType: null,
          gutterAssemblyMode: null,
          integratedGutterBeam: null,
          hasOurGutter: null,
        },
      },
      houseContext: expect.objectContaining({
        footprintPreset: 'l_left',
        footprintParams: expect.objectContaining({
          widthM: '',
          offsetXM: '0',
          setbackM: '0',
        }),
      }),
      dimensions: {
        lengthM: '6',
        projectionM: '3',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
      },
      derived: {
        lengthM: 6.4,
        projectionM: 3.2,
        roofPitchDeg: 7,
        slopeDirection: 'toward_house',
        effectiveRunM: null,
        acrylicRequiredDownslopeM: null,
        joinerPieceLengthM: null,
        joinerRunsTotal: null,
        rafterHouseAllowanceM: null,
        rafterFarAllowanceM: null,
        acrylicAreaM2: null,
        boxEffectiveRunM: null,
        boxRiseMm: null,
        boxMaxFallMm: null,
      },
    });
  });

  it('maps gable modules without changing the family-driving pergola style', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'timber',
        gableEndFramesMode: 'none',
      }),
      result: makeResult({
        slope_direction: 'away_from_house',
        ridge_beam_profile_used: '150x50',
      }),
    });

    expect(raw.pergolaStyle).toBe('gable');
    expect(raw.roof.material).toBe('timber');
    expect(raw.derived?.slopeDirection).toBe('away_from_house');
    expect(raw.gable).toEqual({
      endFramesMode: 'none',
      houseEaveGutter: 'house',
      outerEaveGutter: 'our',
    });
    expect(raw.structural?.profiles?.ridge).toBe('150x50');
    expect(raw.structural?.profiles?.tieBeam).toBe('150x50');
    expect(raw.structural?.profiles?.strut).toBe('50x50');
  });

  it('maps house model override fields into raw house context', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        houseStoreyMode: 'double_storey',
        houseAttachmentStrategy: 'fascia_under_gutter',
        houseEaveHeightM: '3.0',
        houseWallHeightM: '2.7',
        houseRoofPitchDeg: '30',
        houseSoffitDepthMm: '600',
        houseFasciaHeightMm: '240',
        houseGutterWidthMm: '150',
        houseGutterDepthMm: '100',
        houseGutterProjectionMm: '135',
        houseEaveOverhangMm: '650',
      }),
      result: makeResult(),
    });

    expect(raw.houseContext).toEqual(
      expect.objectContaining({
        footprintPreset: 'l_left',
        storeyMode: 'double_storey',
        attachmentStrategy: 'fascia_under_gutter',
        eaveHeightM: '3.0',
        wallHeightM: '2.7',
        roofPitchDeg: '30',
        eave: {
          soffitDepthMm: '600',
          fasciaHeightMm: '240',
          gutterWidthMm: '150',
          gutterDepthMm: '100',
          gutterProjectionMm: '135',
          eaveOverhangMm: '650',
        },
      }),
    );
  });

  it('maps object-first geometry context roof overrides into raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected draft');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        roof: {
          form: 'gable',
          primaryPitchDeg: '18',
          primaryFallDirection: 'negative_x',
          ridgeAxis: 'y',
          appendage: {
            enabled: true,
            hostEdge: 'front',
            pitchDeg: '4',
            dropMm: '500',
          },
        },
      },
    });
    const geometryContext = buildGeometryContextFromObjectFirstDraft({
      snapshot: fixture.snapshot,
      draft,
    });

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule(),
      result: makeResult(),
      objectWorkbenchGeometryContext: geometryContext,
    });

    expect(raw.houseContext.roofForm).toBe('gable');
    expect(raw.houseContext.roofPitchDeg).toBe('18');
    expect(raw.houseContext.roofPrimaryFallDirection).toBe('negative_x');
    expect(raw.houseContext.roofRidgeAxis).toBe('x');
    expect(raw.houseContext.roofAppendage).toEqual({
      enabled: true,
      form: 'mono',
      hostEdge: 'front',
      pitchDeg: '4',
      dropMm: '500',
    });
  });

  it('maps corrected derived shared house roof orientation into raw house context without explicit overrides', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');
    const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: fixture.snapshot,
    });

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        attachmentSide: 'rear',
        houseFootprintPreset: 'straight',
      }),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
    });

    expect(raw.houseContext.roofForm).toBe('mono');
    expect(raw.houseContext.roofPrimaryFallDirection).toBe('negative_y');

    const gableDraft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!gableDraft) throw new Error('Expected draft');
    gableDraft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft: gableDraft,
      compatibility: { roof: { form: 'gable' } },
    });
    const gableProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: fixture.snapshot,
      draft: gableDraft,
    });

    const gableRaw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        attachmentSide: 'rear',
        houseFootprintPreset: 'u_shape',
      }),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(gableProjectModel),
    });

    expect(gableRaw.houseContext.roofRidgeAxis).toBe('x');
  });

  it('maps every preset and editable shared house roof form into raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');

    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      for (const form of HOUSE_ROOF_FORMS) {
        const roof = {
          form,
          primaryPitchDeg: form === 'flat' ? '0' : form === 'mono' ? '12' : form === 'gable' ? '18' : '22',
          primaryFallDirection: 'negative_y',
          ridgeAxis: 'x',
        } as const;
        const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
        if (!draft) throw new Error('Expected draft');
        draft.inputs.modules[0]!.houseFootprintPreset = preset;
        applyObjectFirstCompatibilityDraft({
          snapshot: fixture.snapshot,
          draft,
          compatibility: { roof },
        });
        const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
          snapshot: fixture.snapshot,
          draft,
        });

        const raw = buildRawGeometryModuleInput({
          projectId: 'proj_1',
          estimateId: 'est_1',
          module: makeModule({ houseFootprintPreset: preset }),
          result: makeResult(),
          objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
        });

        expect(raw.houseContext.footprintPreset, `${preset}/${form} footprint`).toBe(preset);
        expect(raw.houseContext.roofForm, `${preset}/${form} roof form`).toBe(form);
        expect(raw.houseContext.roofPitchDeg, `${preset}/${form} roof pitch`).toBe(roof.primaryPitchDeg);
        if (form === 'mono') {
          expect(raw.houseContext.roofPrimaryFallDirection, `${preset}/${form} fall direction`).toBe(
            'negative_y',
          );
        }
        if (form === 'gable' || form === 'hipped') {
          expect(raw.houseContext.roofRidgeAxis, `${preset}/${form} ridge axis`).toBe('x');
        }
      }
    }
  });

  it('maps gable and hipped preset roof rotations into raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');

    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        for (const form of ['gable', 'hipped'] as const) {
          const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
          if (!draft) throw new Error('Expected draft');
          draft.inputs.modules[0]!.attachmentSide = attachmentSide;
          draft.inputs.modules[0]!.houseFootprintPreset = preset;
          applyObjectFirstCompatibilityDraft({
            snapshot: fixture.snapshot,
            draft,
            compatibility: {
              roof: {
                form,
                primaryPitchDeg: form === 'gable' ? '' : '0',
                material: 'corrugated_iron',
              },
            },
          });
          const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
            snapshot: fixture.snapshot,
            draft,
          });

          const raw = buildRawGeometryModuleInput({
            projectId: 'proj_1',
            estimateId: 'est_1',
            module: makeModule({ attachmentSide, houseFootprintPreset: preset }),
            result: makeResult(),
            objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
          });

          expect(projectModel.house?.roof.validation.code, `${preset}/${attachmentSide}/${form} validation`).toBeNull();
          expect(raw.connection.attachmentSide, `${preset}/${attachmentSide}/${form} side`).toBe(attachmentSide);
          expect(raw.houseContext.footprintPreset, `${preset}/${attachmentSide}/${form} footprint`).toBe(preset);
          expect(raw.houseContext.roofForm, `${preset}/${attachmentSide}/${form} form`).toBe(form);
          expect(raw.houseContext.roofPitchDeg, `${preset}/${attachmentSide}/${form} pitch`).toBe('5');
          expect(raw.houseContext.roofRidgeAxis, `${preset}/${attachmentSide}/${form} ridge`).toBe(
            projectModel.house?.roof.ridgeAxis,
          );
        }
      }
    }
  });

  it('maps shared house decks into raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected draft');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        decks: [
          {
            id: 'deck-1',
            name: 'Detached deck',
            kind: 'deck',
            shape: 'preset',
            presetType: 'rect_detached',
            presetRect: {
              widthM: '3.6',
              depthM: '3',
              centerOffsetM: '0',
              detachedGapM: '0.6',
            },
            outline: [
              { alongM: '1.7', depthM: '-3.6' },
              { alongM: '5.3', depthM: '-3.6' },
              { alongM: '5.3', depthM: '-0.6' },
              { alongM: '1.7', depthM: '-0.6' },
            ],
            elevationMode: 'stepped',
            levelOffsetMm: '350',
            hostEdgeId: 'rear',
            isAttached: false,
            surfaceMaterial: 'composite',
          },
        ],
      },
    });
    const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: fixture.snapshot,
      draft,
    });

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule(),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
    });

    expect(raw.houseContext.decks).toEqual([
      expect.objectContaining({
        id: 'deck-1',
        name: 'Detached deck',
        kind: 'deck',
        shape: 'preset',
        presetType: 'rect_detached',
        presetRect: {
          widthMm: 3600,
          depthMm: 3000,
          centerOffsetMm: 0,
          detachedGapMm: 600,
        },
        elevationMode: 'stepped',
        levelOffsetMm: '350',
        hostEdgeId: 'rear',
        isAttached: false,
        surfaceMaterial: 'composite',
        supportContext: expect.objectContaining({
          classification: 'mixed_or_unclear',
        }),
        validation: expect.objectContaining({
          status: 'valid',
        }),
      }),
    ]);
  });

  it('maps shared house openings into raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected draft');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-1',
            label: 'Kitchen slider',
            kind: 'slider',
            panelCount: 3,
            wallId: 'rear',
            widthM: '2.4',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '1.1',
          },
        ],
      },
    });
    const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: fixture.snapshot,
      draft,
    });

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule(),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
    });

    expect(raw.houseContext.openings).toEqual([
      {
        id: 'opening-1',
        label: 'Kitchen slider',
        kind: 'slider',
        panelCount: 3,
        wallId: 'rear',
        hostEdgeId: 'footprint-edge-3',
        widthMm: 2400,
        heightMm: 1200,
        sillHeightMm: 900,
        offsetAlongWallMm: 1100,
        validation: {
          status: 'valid',
          codes: [],
          message: null,
        },
      },
    ]);
  });

  it('preserves hinged-door and stacker kinds in raw house context', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected mono fixture');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected draft');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-door',
            label: 'Rear door',
            kind: 'hinged_door',
            wallId: 'rear',
            widthM: '0.9',
            heightM: '2.1',
            sillHeightM: '0',
            offsetAlongWallM: '0.6',
          },
          {
            id: 'opening-stacker',
            label: 'Rear stacker',
            kind: 'stacker',
            wallId: 'rear',
            widthM: '3.6',
            heightM: '2.1',
            sillHeightM: '0',
            offsetAlongWallM: '1.2',
          },
        ],
      },
    });
    const projectModel = buildObjectWorkbenchCompatibilityProjectModel({
      snapshot: fixture.snapshot,
      draft,
    });

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule(),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(projectModel),
    });

    expect(raw.houseContext.openings).toEqual([
      expect.objectContaining({
        id: 'opening-door',
        kind: 'hinged_door',
        panelCount: null,
        hostEdgeId: 'footprint-edge-3',
      }),
      expect.objectContaining({
        id: 'opening-stacker',
        kind: 'stacker',
        panelCount: null,
        hostEdgeId: 'footprint-edge-3',
      }),
    ]);
  });

  it('preserves deck support metadata from the fixture matrix in raw house context', () => {
    const wrapFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'rear_wrap_multi_edge',
    });
    const warningFixture = makeHouseFirstDeckSupportProjectFixture({
      id: 'rear_warning_heavy_attached',
    });

    const wrapRaw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        attachmentSide: wrapFixture.activeHostSide,
      }),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(wrapFixture.projectModel),
    });
    const warningRaw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        attachmentSide: warningFixture.activeHostSide,
      }),
      result: makeResult(),
      objectWorkbenchGeometryContext: buildGeometryContextFromCompatibilityProjectModel(warningFixture.projectModel),
    });

    expect(wrapRaw.houseContext.decks?.[0]?.supportContext).toEqual(
      expect.objectContaining({
        classification: 'threshold_attached',
        nearestHouseEdgeId: 'left',
      }),
    );
    expect(warningRaw.houseContext.decks?.[0]?.supportContext).toEqual(
      expect.objectContaining({
        classification: 'threshold_attached',
        warningCodes: ['threshold_alignment_offset', 'insufficient_host_edge_contact'],
      }),
    );
  });

  it('maps house footprint size and placement params into raw house context', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        houseFootprintParams: {
          widthM: '8',
          offsetXM: '-1',
          setbackM: '0.4',
          bandDepthM: '2',
          returnRunM: '2.4',
          recessWidthM: '2.4',
          recessDepthM: '1.2',
          leftLegRunM: '2.4',
          rightLegRunM: '2.4',
          sideRunM: '2.4',
        },
        houseFootprintMode: 'custom_polygon',
        houseFootprintPolygon: [
          { alongM: '0', depthM: '2.4' },
          { alongM: '8', depthM: '2.4' },
          { alongM: '8', depthM: '0' },
          { alongM: '0', depthM: '0' },
        ],
      }),
      result: makeResult(),
    });

    expect(raw.houseContext.footprintMode).toBe('custom_polygon');
    expect(raw.houseContext.footprintPolygon).toEqual([
      { alongM: '0', depthM: '2.4' },
      { alongM: '8', depthM: '2.4' },
      { alongM: '8', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ]);
    expect(raw.houseContext.footprintParams).toEqual(
      expect.objectContaining({
        widthM: '8',
        offsetXM: '-1',
        setbackM: '0.4',
      }),
    );
  });

  it('resolves a non-persisted default ridge profile for gable Auto state', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'timber',
        overrides: {},
      }),
      result: makeResult({
        slope_direction: 'away_from_house',
      }),
    });

    expect(raw.structural?.profiles?.ridge).toBe('150x50');

    const explicit = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'timber',
        overrides: { ridgeBeamProfile: '200x50' },
      }),
      result: makeResult({
        slope_direction: 'away_from_house',
      }),
    });

    expect(explicit.structural?.profiles?.ridge).toBe('200x50');
  });

  it('maps box modules with the box flag and box-specific derived pitch override', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        boxPerimeterEnabled: true,
        roofMaterial: 'timber',
      }),
      result: makeResult({
        box_pitch_deg_used: 2.5,
        roof_pitch_deg_used: 9,
        box_perimeter_beam_profile_used: '300x50',
        box_effective_run_m: 3.3,
        box_rise_mm: 173,
        box_max_fall_mm: 200,
      }),
    });

    expect(raw.boxPerimeterEnabled).toBe(true);
    expect(raw.roof.mode).toBe('box_perimeter');
    expect(raw.derived?.roofPitchDeg).toBe(2.5);
    expect(raw.box).toEqual({
      houseEdgeGutter: 'house',
      farEdgeGutter: 'our',
    });
    expect(raw.structural?.profiles?.boxPerimeter).toBe('300x50');
    expect(raw.derived?.boxEffectiveRunM).toBe(3.3);
    expect(raw.derived?.boxRiseMm).toBe(173);
    expect(raw.derived?.boxMaxFallMm).toBe(200);
  });

  it('falls back to raw inputs when no costing result is available', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        invertedEnabled: true,
        houseConnectionType: 'none',
      }),
      result: null,
    });

    expect(raw.derived).toEqual({
      lengthM: null,
      projectionM: null,
      roofPitchDeg: null,
      slopeDirection: null,
      effectiveRunM: null,
      acrylicRequiredDownslopeM: null,
      joinerPieceLengthM: null,
      joinerRunsTotal: null,
      rafterHouseAllowanceM: null,
      rafterFarAllowanceM: null,
      acrylicAreaM2: null,
      boxEffectiveRunM: null,
      boxRiseMm: null,
      boxMaxFallMm: null,
    });
    expect(raw.roof.slopeDirection).toBe('toward_house');
    expect(raw.connection.attachmentSide).toBe('rear');
    expect(raw.roof.overhangM).toBe(0);
  });

  it('maps solver-critical mono structure fields from costing-derived data', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        overhangEnabled: true,
        overhangAmountM: '0.45',
        overrides: {
          ledgerProfile: '100x50',
          rafterProfile: '150x50',
          postProfile: '90x90',
          frontBeamProfile: '150x50',
        },
      }),
      result: makeResult({
        ledger_underside_height_m: 2.55,
        post_cut_height_outer_side_m: 2.31,
        rafter_count: 11,
        rafter_spacing_mm: 601,
        gutter_assembly_mode: 'integrated',
        integrated_gutter_beam: true,
        has_our_gutter: true,
        ledger_profile_used: '100x50',
        post_profile_used: '90x90',
        front_beam_profile_used: '150x50',
        roof_pitch_deg_used: 8,
        overhang_enabled: true,
        overhang_amount_m: 0.35,
      }),
    });

    expect(raw.roof.overhangEnabled).toBe(true);
    expect(raw.roof.overhangM).toBe(0.35);
    expect(raw.structural).toEqual({
      heights: {
        houseUndersideM: 2.55,
        outerUndersideM: 2.31,
        referenceUndersideM: 2.55,
      },
      profiles: {
        post: '90x90',
        rafter: '150x50',
        ledger: '100x50',
        supportBeam: '150x50',
        gutter: '150x50',
        ridge: null,
        tieBeam: '150x50',
        strut: '50x50',
        boxPerimeter: null,
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 601,
      },
      drainage: {
        gutterType: null,
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    });
  });

  it('tolerates partial costing results without normalized inputs', () => {
    const result = makeResult({
      gutter_assembly_mode: 'integrated',
      integrated_gutter_beam: true,
      has_our_gutter: true,
    }) as CostOutputV1;
    delete (result as Partial<CostOutputV1>).inputs_normalized;

    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule(),
      result,
    });

    expect(raw.structural?.drainage).toEqual({
      gutterType: null,
      gutterAssemblyMode: 'integrated',
      integratedGutterBeam: true,
      hasOurGutter: true,
    });
  });

  it('keeps the adapter independent from legacy drawing assembly code', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './buildRawGeometryModuleInput.ts'), 'utf8');

    expect(source).not.toContain('ModulePlanModel');
    expect(source).not.toContain('ModuleSectionModel');
    expect(source).not.toContain('buildAssemblyModel');
  });
});
