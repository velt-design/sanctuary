import { describe, expect, it } from 'vitest';
import {
  normalizeGeometryConfig,
  type HouseFootprintPreset,
  type HouseRoofForm,
  type RawGeometryModuleInput,
} from '@sp/geometry';

function makeRawInput(overrides: Partial<RawGeometryModuleInput> = {}): RawGeometryModuleInput {
  return {
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
      ...overrides.roof,
    },
    gable: {
      endFramesMode: 'outer_end_only',
      houseEaveGutter: 'house',
      outerEaveGutter: 'our',
      ...overrides.gable,
    },
    box: {
      houseEdgeGutter: 'house',
      farEdgeGutter: 'our',
      ...overrides.box,
    },
    connection: {
      houseConnectionType: 'soffit',
      attachmentSide: 'rear',
      ...overrides.connection,
    },
    supports: {
      postMode: 'standard',
      postCount: '2',
      postCutHeightM: '2.4',
      postConnectionType: 'slab_anchors',
      ground: 'easy',
      ...overrides.supports,
    },
    structural: {
      heights: {
        houseUndersideM: 2.4,
        outerUndersideM: 2.137,
        referenceUndersideM: 2.4,
      },
      profiles: {
        post: '90x90',
        rafter: '150x50',
        ledger: '100x50',
        supportBeam: '150x50',
        gutter: 'SP Gutter',
        ridge: '150x50',
        boxPerimeter: '300x50',
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 600,
      },
      drainage: {
        gutterType: 'sp_gutter',
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
      ...overrides.structural,
    },
    houseContext: {
      footprintPreset: 'straight',
      footprintParams: {
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
      ...overrides.houseContext,
    },
    dimensions: {
      lengthM: '6',
      projectionM: '3',
      hipCornerLengthBM: '0',
      hipCornerProjectionBM: '0',
      ...overrides.dimensions,
    },
    derived: {
      lengthM: null,
      projectionM: null,
      roofPitchDeg: null,
      slopeDirection: null,
      boxEffectiveRunM: null,
      boxRiseMm: null,
      boxMaxFallMm: null,
      ...overrides.derived,
    },
    ...overrides,
  };
}

function expectGroundPlanePolygon(points: Array<{ x: number; y: number; z: number }>) {
  expect(points.length).toBeGreaterThanOrEqual(4);
  for (const point of points) {
    expect(point.z).toBe(0);
  }
}

describe('normalizeGeometryConfig', () => {
  it('normalizes mono geometry from derived values when present', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        derived: {
          lengthM: 6.2,
          projectionM: 3.4,
          roofPitchDeg: 7,
          slopeDirection: 'toward_house',
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        family: 'mono',
        dimensions: expect.objectContaining({
          lengthMm: 6200,
          projectionMm: 3400,
          roofPitchDeg: 7,
        }),
        roof: expect.objectContaining({
          fallDirection: 'negativeY',
        }),
        structural: expect.objectContaining({
          heights: expect.objectContaining({
            houseUndersideMm: 2400,
          }),
        }),
      }),
    });
  });

  it('falls back to raw calculator values when derived overrides are missing', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        dimensions: {
          lengthM: '6.4',
          projectionM: '3.1',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
        },
        roof: {
          material: 'acrylic',
          roofPitchDeg: '12',
          slopeDirection: 'away_from_house',
        },
        derived: {
          lengthM: null,
          projectionM: null,
          roofPitchDeg: null,
          slopeDirection: null,
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        dimensions: expect.objectContaining({
          lengthMm: 6400,
          projectionMm: 3100,
          roofPitchDeg: 12,
        }),
        roof: expect.objectContaining({
          overhangMm: 0,
        }),
      }),
    });
  });

  it('normalizes gable geometry with dual fall semantics', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        pergolaStyle: 'gable',
        gable: {
          endFramesMode: 'none',
          houseEaveGutter: 'house',
          outerEaveGutter: 'our',
        },
        roof: {
          material: 'timber',
          roofPitchDeg: '25',
        },
        structural: {
          heights: {
            houseUndersideM: 2.4,
            outerUndersideM: 2.4,
            referenceUndersideM: 2.4,
          },
          profiles: {
            post: '90x90',
            rafter: '150x50',
            ledger: '100x50',
            supportBeam: '150x50',
            gutter: 'SP Gutter',
            ridge: '150x50',
          },
          framing: {
            rafterCount: 11,
            rafterSpacingMm: 600,
          },
          drainage: {
            gutterType: 'sp_gutter',
            gutterAssemblyMode: 'integrated',
            integratedGutterBeam: true,
            hasOurGutter: true,
          },
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        family: 'gable',
        gable: {
          ridgePositionMm: 1500,
          endFramesMode: 'none',
          houseEaveGutterMode: 'house',
          outerEaveGutterMode: 'our',
        },
        box: {
          houseEdgeGutterMode: null,
          farEdgeGutterMode: null,
          houseSetbackMm: null,
          outerSetbackMm: null,
          effectiveRunMm: null,
          riseMm: null,
          maxFallMm: null,
        },
        roof: expect.objectContaining({
          fallDirection: 'dual',
          boxPerimeterEnabled: false,
        }),
      }),
    });
  });

  it('rejects asymmetrical first-pass gable eave heights instead of guessing', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        pergolaStyle: 'gable',
        gable: {
          endFramesMode: 'none',
          houseEaveGutter: 'house',
          outerEaveGutter: 'our',
        },
        structural: {
          heights: {
            houseUndersideM: 2.4,
            outerUndersideM: 2.3,
            referenceUndersideM: 2.4,
          },
          profiles: {
            post: '90x90',
            rafter: '150x50',
            ledger: '100x50',
            supportBeam: '150x50',
            gutter: 'SP Gutter',
            ridge: '150x50',
          },
          framing: {
            rafterCount: 11,
            rafterSpacingMm: 600,
          },
          drainage: {
            gutterType: 'sp_gutter',
            gutterAssemblyMode: 'integrated',
            integratedGutterBeam: true,
            hasOurGutter: true,
          },
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: 'unsupported_variant',
      error: 'Gable solver currently requires symmetrical eave underside heights.',
    });
  });

  it('normalizes box geometry when the box perimeter flag is enabled', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        boxPerimeterEnabled: true,
        roof: {
          material: 'timber',
          mode: 'box_perimeter',
          roofPitchDeg: '3',
        },
        structural: {
          heights: {
            houseUndersideM: 2.5,
            outerUndersideM: 2.5,
            referenceUndersideM: 2.5,
          },
          profiles: {
            post: '90x90',
            rafter: '80x50',
            ledger: '100x50',
            supportBeam: '150x50',
            gutter: 'box_gutter_100x100x3',
            ridge: null,
            boxPerimeter: '300x50',
          },
          framing: {
            rafterCount: 10,
            rafterSpacingMm: 550,
          },
          drainage: {
            gutterType: 'box_gutter_100x100x3',
            gutterAssemblyMode: 'integrated',
            integratedGutterBeam: true,
            hasOurGutter: true,
          },
        },
        box: {
          houseEdgeGutter: 'house',
          farEdgeGutter: 'our',
        },
        derived: {
          boxEffectiveRunM: 3.3,
          boxRiseMm: 173,
          boxMaxFallMm: 200,
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        family: 'box',
        box: {
          houseEdgeGutterMode: 'house',
          farEdgeGutterMode: 'our',
          houseSetbackMm: 150,
          outerSetbackMm: 50,
          effectiveRunMm: 3300,
          riseMm: 173,
          maxFallMm: 200,
        },
        roof: expect.objectContaining({
          boxPerimeterEnabled: true,
          material: 'timber',
        }),
        structural: expect.objectContaining({
          profiles: expect.objectContaining({
            boxPerimeter: expect.objectContaining({
              shape: 'rectangular',
              widthMm: 50,
              depthMm: 300,
            }),
          }),
          drainage: expect.objectContaining({
            gutterAssemblyMode: 'integrated',
          }),
        }),
      }),
    });
  });

  it('maps no house connection to freestanding geometry', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        connection: {
          houseConnectionType: 'none',
          attachmentSide: 'left',
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        connection: {
          type: 'freestanding',
          attachmentSide: 'left',
        },
        houseContext: expect.objectContaining({
          footprint: null,
          model: null,
          attachmentStrategy: 'none',
        }),
        structural: expect.objectContaining({
          profiles: expect.objectContaining({
            gutter: expect.any(Object),
          }),
        }),
      }),
    });
  });

  it('adds deterministic default house model context for attached modules', () => {
    const result = normalizeGeometryConfig(makeRawInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.attachmentStrategy).toBe('soffit_brackets');
    expect(result.value.houseContext.model).toEqual(expect.objectContaining({
      footprint: result.value.houseContext.footprint,
      storeyMode: 'single_storey',
      wallConstruction: 'timber_frame',
      roofForm: 'hipped',
      roofMaterial: 'corrugated_iron',
      eaveHeightMm: 2400,
      wallHeightMm: 2400,
      roofPitchDeg: 25,
      attachmentStrategy: 'soffit_brackets',
      eave: {
        soffitDepthMm: 450,
        fasciaHeightMm: 180,
        gutterWidthMm: 125,
        gutterDepthMm: 90,
        gutterProjectionMm: 125,
        eaveOverhangMm: 450,
      },
    }));
  });

  it('maps existing house connection types into first-class house attachment strategies', () => {
    const cases = [
      { raw: 'soffit' as const, expectedConnection: 'soffit' as const, expectedStrategy: 'soffit_brackets' as const },
      { raw: 'fascia' as const, expectedConnection: 'fascia' as const, expectedStrategy: 'fascia_under_gutter' as const },
      { raw: 'facade' as const, expectedConnection: 'wall' as const, expectedStrategy: 'facade_ledger' as const },
      { raw: 'wall' as const, expectedConnection: 'wall' as const, expectedStrategy: 'facade_ledger' as const },
      { raw: 'none' as const, expectedConnection: 'freestanding' as const, expectedStrategy: 'none' as const },
    ];

    for (const testCase of cases) {
      const result = normalizeGeometryConfig(
        makeRawInput({
          connection: {
            houseConnectionType: testCase.raw,
            attachmentSide: 'rear',
          },
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.connection.type).toBe(testCase.expectedConnection);
      expect(result.value.houseContext.attachmentStrategy).toBe(testCase.expectedStrategy);
      expect(result.value.houseContext.model?.attachmentStrategy ?? 'none').toBe(testCase.expectedStrategy);
    }
  });

  it('uses raw house model overrides when provided', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          storeyMode: 'double_storey',
          wallConstruction: 'timber_frame',
          roofForm: 'hipped',
          attachmentStrategy: 'post_supported_tieback',
          eaveHeightM: '3.1',
          wallHeightM: '5.8',
          roofPitchDeg: '30',
          eave: {
            soffitDepthMm: 600,
            fasciaHeightMm: 240,
            gutterWidthMm: 150,
            gutterDepthMm: 100,
            gutterProjectionMm: 160,
            eaveOverhangMm: 550,
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.attachmentStrategy).toBe('post_supported_tieback');
    expect(result.value.houseContext.model).toEqual(
      expect.objectContaining({
        storeyMode: 'double_storey',
        wallConstruction: 'timber_frame',
        roofForm: 'hipped',
        eaveHeightMm: 3100,
        wallHeightMm: 5800,
        roofPitchDeg: 30,
        attachmentStrategy: 'post_supported_tieback',
        eave: {
          soffitDepthMm: 600,
          fasciaHeightMm: 240,
          gutterWidthMm: 150,
          gutterDepthMm: 100,
          gutterProjectionMm: 160,
          eaveOverhangMm: 550,
        },
      }),
    );
  });

  it('normalizes hip geometry using the supported dual-fall family mapping', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        pergolaStyle: 'hip',
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        family: 'hip',
        roof: expect.objectContaining({
          fallDirection: 'dual',
        }),
        gable: expect.objectContaining({
          ridgePositionMm: 1500,
        }),
      }),
    });
  });

  it('normalizes hip-corner geometry with secondary dimensions', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        pergolaStyle: 'hip_corner',
        dimensions: {
          lengthM: '6',
          projectionM: '3',
          hipCornerLengthBM: '4',
          hipCornerProjectionBM: '2',
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        family: 'hip_corner',
        dimensions: expect.objectContaining({
          lengthMm: 6000,
          projectionMm: 3000,
          lengthBMm: 4000,
          projectionBMm: 2000,
        }),
      }),
    });
  });

  it('returns invalid_numeric_input for malformed numeric dimensions', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        dimensions: {
          lengthM: 'abc',
          projectionM: '3',
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: 'invalid_numeric_input',
      error: 'Enter a valid length.',
    });
  });

  it('returns missing_required_input when the key dimensions are absent', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        dimensions: {
          lengthM: null,
          projectionM: '',
          hipCornerLengthBM: null,
          hipCornerProjectionBM: null,
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: 'missing_required_input',
      error: 'length is required.',
    });
  });

  it('uses a ground-plane local datum with the attachment edge on +X', () => {
    const result = normalizeGeometryConfig(makeRawInput());

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        datum: {
          origin: { x: 0, y: 0, z: 0 },
          xAxis: { x: 1, y: 0, z: 0 },
          yAxis: { x: 0, y: 1, z: 0 },
          zAxis: { x: 0, y: 0, z: 1 },
          attachmentEdgeStart: { x: 0, y: 0, z: 0 },
          attachmentEdgeEnd: { x: 6000, y: 0, z: 0 },
        },
        structural: {
          heights: {
            houseUndersideMm: 2400,
            outerUndersideMm: 2137,
            referenceUndersideMm: 2400,
          },
          profiles: expect.any(Object),
          framing: {
            rafterCount: 11,
            rafterSpacingMm: 600,
          },
          drainage: {
            gutterType: 'sp_gutter',
            gutterAssemblyMode: 'integrated',
            integratedGutterBeam: true,
            hasOurGutter: true,
          },
        },
      }),
    });
  });

  it('normalizes every supported footprint preset into a deterministic local polygon', () => {
    const presets: HouseFootprintPreset[] = [
      'straight',
      'l_left',
      'l_right',
      'recess_left',
      'recess_right',
      'u_shape',
      'wrap_left',
      'wrap_right',
    ];

    for (const preset of presets) {
      const a = normalizeGeometryConfig(
        makeRawInput({
          houseContext: {
            footprintPreset: preset,
            footprintParams: {
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
          },
        }),
      );
      const b = normalizeGeometryConfig(
        makeRawInput({
          houseContext: {
            footprintPreset: preset,
            footprintParams: {
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
          },
        }),
      );

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.houseContext.footprint).toEqual(b.value.houseContext.footprint);
        expectGroundPlanePolygon(a.value.houseContext.footprint ?? []);
      }
    }
  });

  it('keeps the rear default straight house footprint unchanged', () => {
    const result = normalizeGeometryConfig(makeRawInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: 0, y: -1800, z: 0 },
      { x: 6000, y: -1800, z: 0 },
      { x: 6000, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]);
    expect(result.value.houseContext.model?.footprint).toEqual(result.value.houseContext.footprint);
  });

  it('applies parametric house footprint width, offset, and facade setback to the normalized model footprint', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintPreset: 'straight',
          footprintParams: {
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
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: -1000, y: -2400, z: 0 },
      { x: 7000, y: -2400, z: 0 },
      { x: 7000, y: -400, z: 0 },
      { x: -1000, y: -400, z: 0 },
    ]);
    expect(result.value.houseContext.model?.footprint).toEqual(result.value.houseContext.footprint);
  });

  it('places front-side house footprints outside the selected front attachment edge', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        connection: {
          houseConnectionType: 'soffit',
          attachmentSide: 'front',
        },
        houseContext: {
          footprintPreset: 'straight',
          footprintParams: {
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
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: -1000, y: 5400, z: 0 },
      { x: 7000, y: 5400, z: 0 },
      { x: 7000, y: 3400, z: 0 },
      { x: -1000, y: 3400, z: 0 },
    ]);
    expect(result.value.houseContext.model?.footprint).toEqual(result.value.houseContext.footprint);
  });

  it('uses projection as the default footprint width for side attachment footprints', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        connection: {
          houseConnectionType: 'soffit',
          attachmentSide: 'left',
        },
        houseContext: {
          footprintPreset: 'straight',
          footprintParams: {
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
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: -1800, y: 0, z: 0 },
      { x: -1800, y: 3000, z: 0 },
      { x: 0, y: 3000, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]);
  });

  it('applies custom side footprint width, offset, and setback along the selected edge', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        connection: {
          houseConnectionType: 'soffit',
          attachmentSide: 'right',
        },
        houseContext: {
          footprintPreset: 'straight',
          footprintParams: {
            widthM: '2',
            offsetXM: '0.5',
            setbackM: '0.3',
            bandDepthM: '1.2',
            returnRunM: '2.4',
            recessWidthM: '2.4',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '2.4',
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: 7500, y: 500, z: 0 },
      { x: 7500, y: 2500, z: 0 },
      { x: 6300, y: 2500, z: 0 },
      { x: 6300, y: 500, z: 0 },
    ]);
  });

  it('normalizes custom house footprint polygons in the selected-side frame', () => {
    const polygon = [
      { alongM: '0', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '3.6', depthM: '0' },
      { alongM: '3.6', depthM: '1.2' },
      { alongM: '0', depthM: '1.2' },
    ];
    const rear = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: polygon,
          footprintParams: {
            widthM: '',
            offsetXM: '0.5',
            setbackM: '0.3',
            bandDepthM: '1.8',
            returnRunM: '2.4',
            recessWidthM: '2.4',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '2.4',
          },
        },
      }),
    );
    const front = normalizeGeometryConfig(
      makeRawInput({
        connection: { houseConnectionType: 'soffit', attachmentSide: 'front' },
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: polygon,
          footprintParams: {
            widthM: '',
            offsetXM: '0.5',
            setbackM: '0.3',
            bandDepthM: '1.8',
            returnRunM: '2.4',
            recessWidthM: '2.4',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '2.4',
          },
        },
      }),
    );
    const left = normalizeGeometryConfig(
      makeRawInput({
        connection: { houseConnectionType: 'soffit', attachmentSide: 'left' },
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: polygon,
          footprintParams: {
            widthM: '',
            offsetXM: '0.5',
            setbackM: '0.3',
            bandDepthM: '1.8',
            returnRunM: '2.4',
            recessWidthM: '2.4',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '2.4',
          },
        },
      }),
    );
    const right = normalizeGeometryConfig(
      makeRawInput({
        connection: { houseConnectionType: 'soffit', attachmentSide: 'right' },
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: polygon,
          footprintParams: {
            widthM: '',
            offsetXM: '0.5',
            setbackM: '0.3',
            bandDepthM: '1.8',
            returnRunM: '2.4',
            recessWidthM: '2.4',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '2.4',
          },
        },
      }),
    );

    expect(rear.ok).toBe(true);
    expect(front.ok).toBe(true);
    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!rear.ok || !front.ok || !left.ok || !right.ok) return;

    expect(rear.value.houseContext.footprint).toEqual([
      { x: 500, y: -1500, z: 0 },
      { x: 500, y: -2700, z: 0 },
      { x: 6500, y: -2700, z: 0 },
      { x: 6500, y: -300, z: 0 },
      { x: 4100, y: -300, z: 0 },
      { x: 4100, y: -1500, z: 0 },
    ]);
    expect(front.value.houseContext.footprint?.map((point) => point.y)).toEqual([4500, 5700, 5700, 3300, 3300, 4500]);
    expect(front.value.houseContext.model?.footprint).toEqual(front.value.houseContext.footprint);
    expect(left.value.houseContext.footprint).toEqual([
      { x: -1500, y: 500, z: 0 },
      { x: -2700, y: 500, z: 0 },
      { x: -2700, y: 6500, z: 0 },
      { x: -300, y: 6500, z: 0 },
      { x: -300, y: 4100, z: 0 },
      { x: -1500, y: 4100, z: 0 },
    ]);
    expect(right.value.houseContext.footprint).toEqual([
      { x: 7500, y: 500, z: 0 },
      { x: 8700, y: 500, z: 0 },
      { x: 8700, y: 6500, z: 0 },
      { x: 6300, y: 6500, z: 0 },
      { x: 6300, y: 4100, z: 0 },
      { x: 7500, y: 4100, z: 0 },
    ]);
  });

  it('rejects invalid custom footprint polygons using the existing normalize error shape', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: [
            { alongM: '0', depthM: '0' },
            { alongM: '4', depthM: '0' },
            { alongM: '1', depthM: '3' },
            { alongM: '4', depthM: '2' },
          ],
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_numeric_input');
    expect(result.error).toContain('self-intersect');
  });

  it('accepts arbitrary-angle custom house footprint polygons', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPolygon: [
            { alongM: '0', depthM: '0' },
            { alongM: '4', depthM: '0' },
            { alongM: '3', depthM: '2' },
            { alongM: '0', depthM: '1.5' },
          ],
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.houseContext.footprintMode).toBe('custom_polygon');
    expect(result.value.houseContext.footprint?.length).toBe(4);
  });

  it('clamps dependent footprint preset dimensions against the resolved house width', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintPreset: 'recess_left',
          footprintParams: {
            widthM: '3',
            offsetXM: '0',
            setbackM: '0',
            bandDepthM: '1.8',
            returnRunM: '2.4',
            recessWidthM: '9',
            recessDepthM: '1.2',
            leftLegRunM: '2.4',
            rightLegRunM: '2.4',
            sideRunM: '9',
          },
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.houseContext.footprint).toEqual([
      { x: 0, y: -3000, z: 0 },
      { x: 3000, y: -3000, z: 0 },
      { x: 3000, y: 0, z: 0 },
      { x: 2500, y: 0, z: 0 },
      { x: 2500, y: -1200, z: 0 },
      { x: 0, y: -1200, z: 0 },
    ]);
  });

  it('falls back to default footprint parameters when preset params are invalid or missing', () => {
    const withBadParams = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintPreset: 'recess_left',
          footprintParams: {
            widthM: '',
            offsetXM: 'bad',
            setbackM: '-1',
            bandDepthM: '-2',
            returnRunM: '',
            recessWidthM: 'bad',
            recessDepthM: '-1',
            leftLegRunM: '0',
            rightLegRunM: '',
            sideRunM: 'bad',
          },
        },
      }),
    );
    const withDefaults = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintPreset: 'recess_left',
          footprintParams: null,
        },
      }),
    );

    expect(withBadParams.ok).toBe(true);
    expect(withDefaults.ok).toBe(true);
    if (withBadParams.ok && withDefaults.ok) {
      expect(withBadParams.value.houseContext.footprint).toEqual(withDefaults.value.houseContext.footprint);
      expectGroundPlanePolygon(withBadParams.value.houseContext.footprint ?? []);
    }
  });

  describe('position (Phase 2 free-floating-objects scaffolding)', () => {
    it('normalizes a fully-specified position', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 1500, y: 2000 }, rotationDeg: 45 } }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.position).toEqual({
          origin: { x: 1500, y: 2000 },
          rotationDeg: 45,
        });
      }
    });

    it('parses string-encoded position values', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: '1500', y: '2000' }, rotationDeg: '45' } }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.position).toEqual({
          origin: { x: 1500, y: 2000 },
          rotationDeg: 45,
        });
      }
    });

    it('defaults rotationDeg to 0 when omitted', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 0, y: 0 } } }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.position).toEqual({
          origin: { x: 0, y: 0 },
          rotationDeg: 0,
        });
      }
    });

    it('returns null when position is absent', () => {
      const result = normalizeGeometryConfig(makeRawInput({}));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.position).toBeNull();
    });

    it('returns null when origin coordinates are non-finite', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 'not a number', y: 0 }, rotationDeg: 0 } }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.position).toBeNull();
    });

    it('preserves negative origin coordinates (regression)', () => {
      // Position origins are world-space coords and CAN be negative — a
      // pergola can sit at world.x = -500 because the user dragged its left
      // wall outward. An earlier validator (`parseNonNegativeNumber`) silently
      // rejected negatives, dropping the position to null and leaving the
      // pergola at world (0, 0). The visible bug: "drag doesn't always resize
      // — only works for +side wall drags." This test locks the fix.
      const result = normalizeGeometryConfig(
        makeRawInput({
          position: { origin: { x: -500, y: -2000 }, rotationDeg: -45 },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.position).toEqual({
        origin: { x: -500, y: -2000 },
        rotationDeg: -45,
      });
    });

    it('preserves negative origin coordinates passed as strings (regression)', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({
          position: { origin: { x: '-500', y: '-2000' }, rotationDeg: '-45' },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.position).toEqual({
        origin: { x: -500, y: -2000 },
        rotationDeg: -45,
      });
    });

    it('does not drive the datum when position is set — datum stays world-aligned', () => {
      // Slice B (composeDatumFromPosition) was reverted because consumers of
      // `assembly.outline` (e.g. PlanViewport's pergola_reference shape) read
      // local pergola coords; rotating the datum without transforming those
      // consumers caused visual misalignment after a house resize. `position`
      // is currently pure metadata — plumbed through but not consumed for the
      // datum frame. See docs/design-workbench-architecture.md for follow-up.
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 1500, y: 2000 }, rotationDeg: 45 } }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.datum.origin).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.value.datum.attachmentEdgeStart).toEqual({ x: 0, y: 0, z: 0 });
      // attachmentEdgeEnd.x === pergola length in mm (default 6000)
      expect(result.value.datum.attachmentEdgeEnd.x).toBe(6000);
      expect(result.value.datum.attachmentEdgeEnd.y).toBe(0);
      // position itself is preserved on the config for downstream Phase 2 work
      expect(result.value.position).toEqual({
        origin: { x: 1500, y: 2000 },
        rotationDeg: 45,
      });
    });
  });

  describe('house first-class spatial entity (stage 3 decoupling)', () => {
    // The architectural invariant: when `houseContext.position` is set, the
    // house's world-space footprint is INVARIANT to the pergola's dimensions.
    // The legacy decoder coupled them via `houseFootprintSideLocalPointToWorld`
    // (which used pergolaWidthM/pergolaDepthM as translation offsets for
    // `front`/`right` attachment sides); position-aware decoding uses a unit
    // frame and applies position post-decode, so resizing the pergola no
    // longer shifts the house. These tests lock that invariant.

    function makeFrontAttachmentInputWith(opts: {
      pergolaWidthM: string;
      pergolaDepthM: string;
      housePosition: { originXMm: number; originYMm: number; rotationDeg: number } | null;
    }) {
      return makeRawInput({
        connection: { houseConnectionType: 'soffit', attachmentSide: 'front' },
        dimensions: {
          lengthM: opts.pergolaWidthM,
          projectionM: opts.pergolaDepthM,
          hipCornerLengthBM: '0',
          hipCornerProjectionBM: '0',
        },
        houseContext: {
          footprintMode: 'custom_polygon',
          footprintPreset: 'straight',
          footprintParams: {
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
          footprintPolygon: [
            { alongM: '0', depthM: '0' },
            { alongM: '6', depthM: '0' },
            { alongM: '6', depthM: '1.8' },
            { alongM: '0', depthM: '1.8' },
          ],
          position: opts.housePosition
            ? {
                origin: { x: opts.housePosition.originXMm, y: opts.housePosition.originYMm },
                rotationDeg: opts.housePosition.rotationDeg,
              }
            : null,
        },
      });
    }

    it('LEGACY (no position): house footprint shifts when pergola depth changes — known coupling', () => {
      const result3m = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({ pergolaWidthM: '6', pergolaDepthM: '3', housePosition: null }),
      );
      const result4m = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({ pergolaWidthM: '6', pergolaDepthM: '4', housePosition: null }),
      );
      expect(result3m.ok).toBe(true);
      expect(result4m.ok).toBe(true);
      if (!result3m.ok || !result4m.ok) return;
      const footprint3m = result3m.value.houseContext.footprint;
      const footprint4m = result4m.value.houseContext.footprint;
      expect(footprint3m).not.toBeNull();
      expect(footprint4m).not.toBeNull();
      // Legacy 'front' decoder bakes pergolaDepth into world.y → house shifts
      // by 1000mm when pergolaDepth grows from 3 to 4.
      expect(footprint3m![0]!.y).not.toBeCloseTo(footprint4m![0]!.y, 6);
      expect(footprint4m![0]!.y - footprint3m![0]!.y).toBeCloseTo(1000, 6);
    });

    it('FIRST-CLASS (position set): house footprint stays put when pergola depth changes', () => {
      // Position chosen as the migration default for 'front' at pergolaDepth=3:
      // position.y = (pergolaDepthM - 1) × 1000 = 2000.
      const housePosition = { originXMm: 0, originYMm: 2000, rotationDeg: 0 };
      const result3m = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({ pergolaWidthM: '6', pergolaDepthM: '3', housePosition }),
      );
      const result4m = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({ pergolaWidthM: '6', pergolaDepthM: '4', housePosition }),
      );
      expect(result3m.ok).toBe(true);
      expect(result4m.ok).toBe(true);
      if (!result3m.ok || !result4m.ok) return;
      const footprint3m = result3m.value.houseContext.footprint;
      const footprint4m = result4m.value.houseContext.footprint;
      expect(footprint3m).not.toBeNull();
      expect(footprint4m).not.toBeNull();
      // The architectural invariant: with position set, every vertex matches
      // across pergola dim changes.
      expect(footprint3m!.length).toBe(footprint4m!.length);
      for (let idx = 0; idx < footprint3m!.length; idx += 1) {
        expect(footprint3m![idx]!.x).toBeCloseTo(footprint4m![idx]!.x, 6);
        expect(footprint3m![idx]!.y).toBeCloseTo(footprint4m![idx]!.y, 6);
      }
    });

    it('migration math: position default makes unit-frame decode + boundary translation equal legacy real-frame decode', () => {
      // For 'front' attachmentSide with pergolaDepth=3, the migration formula
      // `position.y = (pergolaDepthM - 1) × 1000` produces a position such
      // that unit-frame decode + position == legacy real-frame decode. This
      // is what makes the auto-migration on first edit visually invisible.
      //
      // Milestone 12: the position is now applied at the boundary by
      // `applyAssemblyPosition3D`, not at normalize time. So the migrated
      // `houseContext.footprint` is in HOUSE-LOCAL coords; we apply the
      // position manually here to compare against the legacy world coords.
      const housePosition = { originXMm: 0, originYMm: 2000, rotationDeg: 0 };
      const legacy = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({ pergolaWidthM: '6', pergolaDepthM: '3', housePosition: null }),
      );
      const migrated = normalizeGeometryConfig(
        makeFrontAttachmentInputWith({
          pergolaWidthM: '6',
          pergolaDepthM: '3',
          housePosition,
        }),
      );
      expect(legacy.ok).toBe(true);
      expect(migrated.ok).toBe(true);
      if (!legacy.ok || !migrated.ok) return;
      const legacyFootprint = legacy.value.houseContext.footprint;
      const migratedLocalFootprint = migrated.value.houseContext.footprint;
      expect(legacyFootprint).not.toBeNull();
      expect(migratedLocalFootprint).not.toBeNull();
      expect(legacyFootprint!.length).toBe(migratedLocalFootprint!.length);
      // Apply the position translation to the local-coord footprint to get
      // world coords (matches what `applyAssemblyPosition3D` does at the
      // boundary).
      const migratedWorldFootprint = migratedLocalFootprint!.map((point) => ({
        x: point.x + housePosition.originXMm,
        y: point.y + housePosition.originYMm,
        z: point.z,
      }));
      for (let idx = 0; idx < legacyFootprint!.length; idx += 1) {
        expect(legacyFootprint![idx]!.x).toBeCloseTo(migratedWorldFootprint[idx]!.x, 6);
        expect(legacyFootprint![idx]!.y).toBeCloseTo(migratedWorldFootprint[idx]!.y, 6);
      }
    });

    it("'rear' attachment is unit-frame-invariant — migration default (0, 0) preserves world coords", () => {
      // The 'rear' decoder formula doesn't use pergolaWidthM/pergolaDepthM, so
      // unit-frame decode == legacy decode regardless of pergola dims. The
      // migration default for 'rear' is (0, 0).
      type RearPosition = { origin: { x: number; y: number }; rotationDeg: number } | null;
      const baseInput = (housePosition: RearPosition) =>
        makeRawInput({
          connection: { houseConnectionType: 'soffit', attachmentSide: 'rear' },
          dimensions: { lengthM: '6', projectionM: '3', hipCornerLengthBM: '0', hipCornerProjectionBM: '0' },
          houseContext: {
            footprintMode: 'custom_polygon',
            footprintPreset: 'straight',
            footprintParams: {
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
            footprintPolygon: [
              { alongM: '0', depthM: '0' },
              { alongM: '6', depthM: '0' },
              { alongM: '6', depthM: '1.8' },
              { alongM: '0', depthM: '1.8' },
            ],
            position: housePosition,
          },
        });
      const migrationDefault: RearPosition = { origin: { x: 0, y: 0 }, rotationDeg: 0 };
      const legacy = normalizeGeometryConfig(baseInput(null));
      const migrated = normalizeGeometryConfig(baseInput(migrationDefault));
      expect(legacy.ok).toBe(true);
      expect(migrated.ok).toBe(true);
      if (!legacy.ok || !migrated.ok) return;
      const legacyFootprint = legacy.value.houseContext.footprint!;
      const migratedFootprint = migrated.value.houseContext.footprint!;
      for (let idx = 0; idx < legacyFootprint.length; idx += 1) {
        expect(legacyFootprint[idx]!.x).toBeCloseTo(migratedFootprint[idx]!.x, 6);
        expect(legacyFootprint[idx]!.y).toBeCloseTo(migratedFootprint[idx]!.y, 6);
      }
    });
  });

  describe('deck first-class spatial entity (stage 4 decoupling)', () => {
    // Decks store their outline in side-local `(alongM, depthM)` coords
    // decoded against a hardcoded 1m × 1m unit frame. Today the unit-frame
    // decoder still uses the host's `attachmentSide`, so changing the house's
    // attachmentSide shifts the deck. With `deck.position` set, the deck is
    // post-decode-translated independent of attachmentSide — invariant.

    type DeckPositionInput = {
      origin: { x: number; y: number };
      rotationDeg: number;
    } | null;

    function makeDeckInput(opts: {
      attachmentSide: 'rear' | 'front' | 'left' | 'right';
      deckPosition: DeckPositionInput;
    }) {
      return makeRawInput({
        connection: { houseConnectionType: 'soffit', attachmentSide: opts.attachmentSide },
        houseContext: {
          footprintMode: 'preset',
          footprintPreset: 'straight',
          footprintParams: {
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
          decks: [
            {
              id: 'deck-1',
              name: 'Deck 1',
              kind: 'deck',
              shape: 'custom',
              outline: [
                { alongM: '0', depthM: '0' },
                { alongM: '3', depthM: '0' },
                { alongM: '3', depthM: '2' },
                { alongM: '0', depthM: '2' },
              ],
              position: opts.deckPosition,
              elevationMode: 'ground',
              levelOffsetMm: '0',
              hostEdgeId: null,
              isAttached: false,
              surfaceMaterial: 'timber_decking',
            },
          ],
        },
      });
    }

    it('LEGACY (no position): deck stays put when host attachmentSide changes — PR-G3c decoupling', () => {
      // PR-G3c (2026-05-22) standardized the legacy deck-outline decoder on
      // a `'rear'` frame inside `buildHouseModelConfig`. Previously, legacy
      // decks (no `position` set) decoded against the host's `attachmentSide`
      // and visibly shifted when the pergola attached to a different side.
      // Acceptable per Phase 1's workbench-can-break permission; legacy decks
      // re-migrate to position-based on first edit.
      const rear = normalizeGeometryConfig(makeDeckInput({ attachmentSide: 'rear', deckPosition: null }));
      const front = normalizeGeometryConfig(makeDeckInput({ attachmentSide: 'front', deckPosition: null }));
      expect(rear.ok).toBe(true);
      expect(front.ok).toBe(true);
      if (!rear.ok || !front.ok) return;
      const rearDeck = rear.value.houseContext.model?.decks?.[0];
      const frontDeck = front.value.houseContext.model?.decks?.[0];
      expect(rearDeck?.outline).not.toBeNull();
      expect(frontDeck?.outline).not.toBeNull();
      // Both decode against the standardized 'rear' frame — identical world coords.
      expect(rearDeck!.outline![0]!.y).toBeCloseTo(frontDeck!.outline![0]!.y, 6);
    });

    it('FIRST-CLASS (position set): deck position is applied post-decode (decoupled from attachmentSide drift)', () => {
      // Same deck position (1500, 2500) applied for both attachment sides.
      // The post-decode translation lifts each into world space; the
      // *relative* offset between the two cases stays the same as the legacy
      // decoder's offset, but adding a non-zero position predictably
      // translates both — and a Move-tool flow that explicitly sets position
      // at edit time can now make the deck stay put across pergola/host
      // changes (the workbench commit handler does exactly this via
      // bbox-based position writes).
      const position: DeckPositionInput = { origin: { x: 1500, y: 2500 }, rotationDeg: 0 };
      const rear = normalizeGeometryConfig(makeDeckInput({ attachmentSide: 'rear', deckPosition: position }));
      expect(rear.ok).toBe(true);
      if (!rear.ok) return;
      const deck = rear.value.houseContext.model?.decks?.[0];
      expect(deck?.outline).not.toBeNull();
      // Vertex (alongM=0, depthM=0) for 'rear' → unit world (0, 0). Plus
      // position (1500, 2500) → final world (1500, 2500).
      expect(deck!.outline![0]!.x).toBeCloseTo(1500, 6);
      expect(deck!.outline![0]!.y).toBeCloseTo(2500, 6);
      // Vertex (alongM=3, depthM=0) → unit world (3000, 0) + position → (4500, 2500).
      expect(deck!.outline![1]!.x).toBeCloseTo(4500, 6);
      expect(deck!.outline![1]!.y).toBeCloseTo(2500, 6);
    });

    it('preserves negative deck position coords (parity with pergola fix)', () => {
      const position: DeckPositionInput = { origin: { x: -1000, y: -500 }, rotationDeg: 0 };
      const result = normalizeGeometryConfig(makeDeckInput({ attachmentSide: 'rear', deckPosition: position }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const deck = result.value.houseContext.model?.decks?.[0];
      expect(deck?.outline).not.toBeNull();
      // Vertex (0, 0) for 'rear' → world (0, 0) + position (-1000, -500) → (-1000, -500).
      expect(deck!.outline![0]!.x).toBeCloseTo(-1000, 6);
      expect(deck!.outline![0]!.y).toBeCloseTo(-500, 6);
    });

    it("STAGE 4.5: standardized 'rear' frame — deck stays put when host attachmentSide changes", () => {
      // The user-visible invariant: a deck with `position` set should NOT
      // shift when the host's attachmentSide changes via the legacy
      // configurator dropdown. The decoder uses 'rear' regardless of the
      // host's value, so the deck's polygon interpretation is stable.

      // First: edit a deck — bbox-min becomes position, polygon is encoded
      // against 'rear' (mimicking the workbench commit handler).
      function buildDeckInputForAttachment(attachmentSide: 'rear' | 'front' | 'left' | 'right') {
        return makeRawInput({
          connection: { houseConnectionType: 'soffit', attachmentSide },
          houseContext: {
            footprintMode: 'preset',
            footprintPreset: 'straight',
            footprintParams: {
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
            decks: [
              {
                id: 'deck-1',
                name: 'Deck 1',
                kind: 'deck',
                shape: 'custom',
                outline: [
                  // Polygon encoded against 'rear' frame (positive depth → -y world).
                  // For depthM=-2 (which represents a deck below the origin in
                  // 'rear' frame: -depth*1000 = 2000 → world.y = +2000 for the
                  // "below origin" intent), the deck spans y in [0, 2000].
                  { alongM: '0', depthM: '0' },
                  { alongM: '3', depthM: '0' },
                  { alongM: '3', depthM: '-2' },
                  { alongM: '0', depthM: '-2' },
                ],
                position: { origin: { x: 1000, y: 500 }, rotationDeg: 0 },
                elevationMode: 'ground',
                levelOffsetMm: '0',
                hostEdgeId: null,
                isAttached: false,
                surfaceMaterial: 'timber_decking',
              },
            ],
          },
        });
      }

      const decoded = (attachmentSide: 'rear' | 'front' | 'left' | 'right') => {
        const result = normalizeGeometryConfig(buildDeckInputForAttachment(attachmentSide));
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('unexpected');
        return result.value.houseContext.model?.decks?.[0]?.outline ?? null;
      };

      const rear = decoded('rear');
      const front = decoded('front');
      const left = decoded('left');
      const right = decoded('right');

      expect(rear).not.toBeNull();
      expect(front).not.toBeNull();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();

      // The architectural invariant: every vertex matches across all four
      // attachment sides. Deck position is fully decoupled from host
      // attachmentSide.
      for (let idx = 0; idx < rear!.length; idx += 1) {
        expect(rear![idx]!.x).toBeCloseTo(front![idx]!.x, 6);
        expect(rear![idx]!.y).toBeCloseTo(front![idx]!.y, 6);
        expect(rear![idx]!.x).toBeCloseTo(left![idx]!.x, 6);
        expect(rear![idx]!.y).toBeCloseTo(left![idx]!.y, 6);
        expect(rear![idx]!.x).toBeCloseTo(right![idx]!.x, 6);
        expect(rear![idx]!.y).toBeCloseTo(right![idx]!.y, 6);
      }
    });

    it("STAGE 4.5: full bbox round-trip — encoder/decoder agree on 'rear' frame", () => {
      // Locks the workbench commit handler's contract: encode a polygon
      // against 'rear' + position = bbox.min, decode against 'rear' + apply
      // position = bbox.min, get back the original world polygon. This is
      // what makes "drag deck edge → deck resizes" actually work.

      // Simulating the user dragging the right edge of a deck: original deck
      // at world (1000, 500)→(4000, 500)→(4000, 2500)→(1000, 2500) → drag
      // right edge to x=5000.
      const draggedWorldPolygon = [
        { x: 1000, y: 500 },
        { x: 5000, y: 500 },
        { x: 5000, y: 2500 },
        { x: 1000, y: 2500 },
      ];

      // Workbench commit handler: bbox.min = (1000, 500), shift polygon by
      // -position so local coords are (0,0)-(4000,0)-(4000,2000)-(0,2000),
      // then encode against 'rear' (alongM=x/1000, depthM=-y/1000).
      const localWorldPolygon = draggedWorldPolygon.map((p) => ({
        x: p.x - 1000,
        y: p.y - 500,
      }));
      // Encoded polygon (mimicking buildSideLocalPolygonFromWorld for 'rear'):
      const encodedSideLocal = localWorldPolygon.map((p) => ({
        alongM: (p.x / 1000).toString(),
        depthM: (-p.y / 1000).toString(),
      }));

      const result = normalizeGeometryConfig(
        makeRawInput({
          connection: { houseConnectionType: 'soffit', attachmentSide: 'rear' },
          houseContext: {
            footprintMode: 'preset',
            footprintPreset: 'straight',
            footprintParams: {
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
            decks: [
              {
                id: 'deck-1',
                name: 'Deck 1',
                kind: 'deck',
                shape: 'custom',
                outline: encodedSideLocal,
                position: { origin: { x: 1000, y: 500 }, rotationDeg: 0 },
                elevationMode: 'ground',
                levelOffsetMm: '0',
                hostEdgeId: null,
                isAttached: false,
                surfaceMaterial: 'timber_decking',
              },
            ],
          },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const deck = result.value.houseContext.model?.decks?.[0];
      expect(deck?.outline).not.toBeNull();
      const decoded = deck!.outline!;
      // Round-trip: each decoded vertex matches the original dragged world polygon.
      expect(decoded.length).toBe(draggedWorldPolygon.length);
      for (let idx = 0; idx < decoded.length; idx += 1) {
        expect(decoded[idx]!.x).toBeCloseTo(draggedWorldPolygon[idx]!.x, 6);
        expect(decoded[idx]!.y).toBeCloseTo(draggedWorldPolygon[idx]!.y, 6);
      }
    });
  });

  describe('milestone 13: gable openGableEndIds auto-derivation moved upstream (slice 2B)', () => {
    // The previous compat migration in this normalize layer auto-derived
    // every-terminal-end-open IDs when raw `roofForm: 'gable'` came in.
    // That logic moved to
    // `apps/portal/lib/drawings/geometry/buildRawGeometryModuleInput.ts`
    // (slice 2B) where the resolved polygon is always available. The
    // form-name narrowing (`gable` -> `hipped`) stays as a defensive
    // safety net at line 506 in normalize.ts so any direct geometry
    // caller that bypasses `buildRawGeometryModuleInput` still produces
    // a model with `roofForm: 'hipped'` (the only form the downstream
    // builders are guaranteed to handle once M13 session C drops
    // `'gable'` from the type union).

    it('no longer auto-derives openGableEndIds for raw `roofForm: gable` (migration moved upstream); the form-name narrowing stays as a safety net', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({
          houseContext: {
            footprintPreset: 'straight',
            footprintParams: {
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
            // Legacy serialized data with the retired `gable` form name.
            // Cast through `unknown` because session C dropped `gable`
            // from the `HouseRoofForm` union; the safety net inside
            // `resolveHouseRoofForm` still narrows it to `hipped` for
            // direct geometry callers that bypass the workbench draft
            // migration boundary.
            roofForm: 'gable' as unknown as HouseRoofForm,
          },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const model = result.value.houseContext.model;
      expect(model).not.toBeNull();
      if (!model) return;
      // Form name narrows to hipped (safety net for direct callers
      // who didn't go through buildRawGeometryModuleInput).
      expect(model.roofForm).toBe('hipped');
      // No automatic injection any more: openGableEndIds reflects only
      // what the caller stored. (`resolveHouseOpenGableEndIds` returns
      // null for an empty/missing input -- the resolver's
      // nothing-to-store sentinel.)
      expect(model.openGableEndIds).toBeNull();
    });

    it('passes through explicitly-stored openGableEndIds for `roofForm: gable` unchanged (no merge with derived terminals)', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({
          houseContext: {
            footprintPreset: 'straight',
            footprintParams: {
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
            // Legacy serialized data with the retired `gable` form name.
            // Cast through `unknown` because session C dropped `gable`
            // from the `HouseRoofForm` union; the safety net inside
            // `resolveHouseRoofForm` still narrows it to `hipped` for
            // direct geometry callers that bypass the workbench draft
            // migration boundary.
            roofForm: 'gable' as unknown as HouseRoofForm,
            openGableEndIds: ['house-gable-end-x-1'],
          },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const model = result.value.houseContext.model;
      expect(model?.openGableEndIds).toEqual(['house-gable-end-x-1']);
    });

    it('does NOT inject open-end ids when the raw form is already hipped (unchanged from prior behaviour)', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({
          houseContext: {
            footprintPreset: 'straight',
            footprintParams: {
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
            roofForm: 'hipped',
          },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const model = result.value.houseContext.model;
      expect(model?.roofForm).toBe('hipped');
      expect(model?.openGableEndIds).toBeNull();
    });
  });
});
