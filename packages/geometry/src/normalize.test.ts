import { describe, expect, it } from 'vitest';
import { normalizeGeometryConfig, type HouseFootprintPreset, type RawGeometryModuleInput } from '@sp/geometry';

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

    it('drives the datum origin + axes when position is set (slice B)', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 1500, y: 2000 }, rotationDeg: 0 } }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Origin from position
      expect(result.value.datum.origin).toEqual({ x: 1500, y: 2000, z: 0 });
      // Rotation 0 → axes are world-aligned (use toBeCloseTo to avoid ±0 mismatch from sin(0))
      expect(result.value.datum.xAxis.x).toBeCloseTo(1, 6);
      expect(result.value.datum.xAxis.y).toBeCloseTo(0, 6);
      expect(result.value.datum.yAxis.x).toBeCloseTo(0, 6);
      expect(result.value.datum.yAxis.y).toBeCloseTo(1, 6);
      expect(result.value.datum.zAxis).toEqual({ x: 0, y: 0, z: 1 });
    });

    it('rotates the datum axes by rotationDeg around +Z', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({ position: { origin: { x: 0, y: 0 }, rotationDeg: 90 } }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 90° CCW: world-X → +Y, world-Y → -X
      expect(result.value.datum.xAxis.x).toBeCloseTo(0, 6);
      expect(result.value.datum.xAxis.y).toBeCloseTo(1, 6);
      expect(result.value.datum.yAxis.x).toBeCloseTo(-1, 6);
      expect(result.value.datum.yAxis.y).toBeCloseTo(0, 6);
    });

    it('transforms the attachmentEdge endpoints by position translation + rotation', () => {
      const result = normalizeGeometryConfig(
        makeRawInput({
          dimensions: { lengthM: '6', projectionM: '3', hipCornerLengthBM: '0', hipCornerProjectionBM: '0' },
          position: { origin: { x: 1000, y: 2000 }, rotationDeg: 90 },
        }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Local (0,0) → world (1000, 2000)
      expect(result.value.datum.attachmentEdgeStart.x).toBeCloseTo(1000, 6);
      expect(result.value.datum.attachmentEdgeStart.y).toBeCloseTo(2000, 6);
      // Local (6000, 0) rotated 90° → (0, 6000), translated → (1000, 8000)
      expect(result.value.datum.attachmentEdgeEnd.x).toBeCloseTo(1000, 6);
      expect(result.value.datum.attachmentEdgeEnd.y).toBeCloseTo(8000, 6);
    });

    it('falls back to the world-origin datum when position is null', () => {
      const result = normalizeGeometryConfig(makeRawInput({}));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.datum.origin).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.value.datum.attachmentEdgeStart).toEqual({ x: 0, y: 0, z: 0 });
      // attachmentEdgeEnd.x === pergola length in mm (default 6000)
      expect(result.value.datum.attachmentEdgeEnd.x).toBe(6000);
      expect(result.value.datum.attachmentEdgeEnd.y).toBe(0);
    });
  });
});
