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
        dimensions: {
          lengthMm: 6400,
          projectionMm: 3100,
          roofPitchDeg: 12,
        },
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
            boxPerimeter: {
              shape: 'rectangular',
              widthMm: 50,
              depthMm: 300,
            },
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
        }),
        structural: expect.objectContaining({
          profiles: expect.objectContaining({
            gutter: expect.any(Object),
          }),
        }),
      }),
    });
  });

  it('returns unsupported_family for unsupported pergola styles', () => {
    const result = normalizeGeometryConfig(
      makeRawInput({
        pergolaStyle: 'hip',
      }),
    );

    expect(result).toEqual({
      ok: false,
      code: 'unsupported_family',
      error: expect.stringContaining('hip'),
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

  it('falls back to default footprint parameters when preset params are invalid or missing', () => {
    const withBadParams = normalizeGeometryConfig(
      makeRawInput({
        houseContext: {
          footprintPreset: 'recess_left',
          footprintParams: {
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
});
