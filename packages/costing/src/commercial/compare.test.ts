import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
  compareCommercialDesignInputsV1,
  type CommercialDesignInputV1,
  type CommercialModuleInputV1,
  type CommercialParityReportV1,
} from '@sp/costing';

function makeModule(overrides: Partial<CommercialModuleInputV1> = {}): CommercialModuleInputV1 {
  return {
    id: 'module-1',
    label: 'Module 1',
    sourceModuleIndex: 0,
    trustStatus: 'ready',
    designIntent: {
      pergolaStyle: 'pitched',
      roofMaterial: 'acrylic',
      extrusionColour: 'White',
      roofType: 'pitched',
      houseConnectionType: 'soffit',
      attachmentSide: 'rear',
      postConnectionType: 'slab_anchors',
      ground: null,
      roofPitchDeg: 5,
      dimensions: {
        lengthM: 6,
        projectionM: 3,
      },
      roofOptions: {
        boxPerimeterEnabled: false,
        gableEndFramesMode: 'none',
        mixedRoofMode: null,
        overhangEnabled: false,
        invertedEnabled: false,
      },
    },
    solvedGeometry: {
      status: 'ready',
      geometrySource: 'calculator_compat',
      primaryDimensionsM: {
        length: 6,
        projection: 3,
      },
      roofPlaneCount: 1,
      attachmentLengthM: 6,
      warnings: [],
    },
    quantityTakeoff: {
      primaryDimensions: {
        lengthM: 6,
        projectionM: 3,
        roofAreaM2: 18,
      },
      roofPlanes: [
        {
          id: 'plane-1',
          areaM2: 18,
          bayCount: 10,
          rafterCount: 11,
          rafterProjectedRunM: 2.85,
          rafterCutLengthM: 3,
          rafterLengthM: 3,
          rafterSpacingMm: 600,
          rafterTotalLengthM: 33,
          claddingAreaM2: 18,
          claddingDownslopeLengthM: 2.88,
          claddingPanelCount: 4,
          joinerCount: 11,
          joinerTargetLengthM: 2.88,
          joinerTotalLengthM: 33,
        },
      ],
      posts: { count: 2, cutHeightM: 2.4, profile: '90x90' },
      rafters: {
        count: 11,
        bayCount: 10,
        spacingMm: 600,
        effectiveRunM: 2.85,
        projectedRunM: 2.85,
        cutLengthM: 3,
        totalLengthM: 33,
        profile: '100x50',
      },
      beams: {
        ledgerLengthM: 6,
        frontBeamLengthM: 6,
        ridgeLengthM: null,
        tieBeamLengthM: null,
        totalBeamLengthM: 6,
        ledgerProfile: '150x50',
        frontBeamProfile: '150x50',
        ridgeProfile: null,
      },
      gutters: {
        ourGutterLengthM: 6,
        houseGutterLengthM: 0,
        totalLengthM: 6,
        downpipeCount: 2,
        downpipeJoinCount: 1,
        downpipeElbowCount: 3,
      },
      roofCladding: {
        acrylicAreaM2: 18,
        timberAreaM2: 0,
        sheetCount: 4,
        effectiveRunM: 2.85,
        acrylicRequiredDownslopeM: 2.88,
        averageDownslopeLengthM: 2.88,
        joinerRuns: 11,
        panelCount: 4,
        totalAreaM2: 18,
      },
      joiners: {
        count: 11,
        totalLengthM: 33,
        averageLengthM: 3,
        profile: 'acrylic_joiner',
      },
      flashings: {
        totalLengthM: 1.5,
        count: 1,
        surfaceAreaM2: 0.45,
        byBandM: { '201-300': 1.5 },
        byGirthM: { '300': 1.5 },
      },
      infills: {
        itemCount: 0,
        sheetAreaM2: 0,
        stripPanelCount: 0,
      },
      blindsAndAccessories: {
        blindCount: 0,
        accessoryCount: 0,
        notes: [],
      },
    },
    options: {},
    diagnostics: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<CommercialDesignInputV1> = {}): CommercialDesignInputV1 {
  return {
    schemaVersion: COMMERCIAL_DESIGN_INPUT_SCHEMA_VERSION_V1,
    source: 'calculator_compat',
    trustStatus: 'ready',
    identity: {
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designRequestId: null,
    },
    pergolas: [
      {
        id: 'pergola-1',
        label: 'Pergola 1',
        trustStatus: 'ready',
        modules: [makeModule()],
        diagnostics: [],
      },
    ],
    siteCommercial: {
      jobType: 'residential',
      access: 'normal',
      height: 'single_storey',
      travelExGst: 0,
      extrasAllowanceExGst: 0,
      quoteDiscountPct: 0,
    },
    diagnostics: [],
    ...overrides,
  };
}

function cloneInput(input: CommercialDesignInputV1): CommercialDesignInputV1 {
  return structuredClone(input) as CommercialDesignInputV1;
}

describe('compareCommercialDesignInputsV1', () => {
  it('returns match for identical commercial payloads', () => {
    const input = makeInput();
    const report = compareCommercialDesignInputsV1(input, cloneInput(input));

    expect(report.status).toBe('match');
    expect(report.counts).toMatchObject({
      pergolasCompared: 1,
      modulesCompared: 1,
      differences: 0,
    });
    expect(report.summary).toEqual({
      byCategory: {},
      byDriftOrigin: {},
      bySeverity: {},
      byModule: {},
    });
  });

  it('compares calculator and workbench sources without treating source difference as drift', () => {
    const left = makeInput({ source: 'calculator_compat' });
    const right = makeInput({ source: 'workbench_solved' });
    right.pergolas[0]!.modules[0]!.solvedGeometry.geometrySource = 'workbench_solved';

    const report = compareCommercialDesignInputsV1(left, right, {
      labelLeft: 'calculator',
      labelRight: 'workbench',
    });

    expect(report.status).toBe('match');
    expect(report.left.label).toBe('calculator');
    expect(report.right.label).toBe('workbench');
  });

  it('keeps dimension and area differences inside default tolerance as match', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.pergolas[0]!.modules[0]!.solvedGeometry.primaryDimensionsM!.length = 6.019;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.primaryDimensions!.roofAreaM2 = 18.09;

    const report = compareCommercialDesignInputsV1(left, right);

    expect(report.status).toBe('match');
    expect(report.differences).toEqual([]);
  });

  it('reports count, string, trust, and site drift as structured differences', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.siteCommercial.access = 'hard';
    right.pergolas[0]!.modules[0]!.trustStatus = 'approximate';
    right.pergolas[0]!.modules[0]!.designIntent.roofMaterial = 'timber';
    right.pergolas[0]!.modules[0]!.quantityTakeoff.posts!.count = 3;

    const report = compareCommercialDesignInputsV1(left, right);

    expect(report.status).toBe('drift');
    expect(report.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'siteCommercial.access', category: 'site_commercial' }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.trustStatus',
          category: 'trust',
          driftOrigin: 'solved_geometry',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.designIntent.roofMaterial',
          category: 'design_intent',
          driftOrigin: 'authored_intent',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.posts.count',
          category: 'quantity_takeoff',
          driftOrigin: 'physical_takeoff',
        }),
      ]),
    );
    expect(report.counts.warningDifferences).toBeGreaterThanOrEqual(4);
    expect(report.summary?.byCategory).toMatchObject({
      site_commercial: 1,
      trust: 1,
      design_intent: 1,
      quantity_takeoff: 1,
    });
    expect(report.summary?.byDriftOrigin).toMatchObject({
      commercial_mapping: 1,
      solved_geometry: 1,
      authored_intent: 1,
      physical_takeoff: 1,
    });
    expect(report.summary?.bySeverity.warning).toBeGreaterThanOrEqual(4);
    expect(report.summary?.byModule['pergola-1/source:0']).toMatchObject({
      pergolaId: 'pergola-1',
      moduleKey: 'source:0',
      sourceModuleIndex: 0,
      differences: 3,
      warningDifferences: 3,
      blockingDifferences: 0,
    });
  });

  it('adds originDetail diagnostics for each parity drift origin', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.siteCommercial.access = 'hard';
    right.pergolas[0]!.modules[0]!.designIntent.attachmentSide = 'left';
    right.pergolas[0]!.modules[0]!.solvedGeometry.roofPlaneCount = 2;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.bayCount = 11;
    right.pergolas[0]!.modules[0]!.options = {
      overrides: { ledgerProfile: '200x50' },
    };
    left.pergolas[0]!.modules[0]!.options = {
      overrides: { ledgerProfile: '150x50' },
    };

    const report = compareCommercialDesignInputsV1(left, right);

    expect(report.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'siteCommercial.access',
          originDetail: {
            origin: 'commercial_mapping',
            sourceCategory: 'site_commercial',
            fieldPath: 'siteCommercial.access',
            explanation: 'Commercial mapping mismatch at siteCommercial.access.',
          },
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.designIntent.attachmentSide',
          originDetail: {
            origin: 'authored_intent',
            sourceCategory: 'design_intent',
            fieldPath: 'designIntent.attachmentSide',
            explanation: 'Authored intent mismatch at designIntent.attachmentSide.',
          },
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.solvedGeometry.roofPlaneCount',
          originDetail: {
            origin: 'solved_geometry',
            sourceCategory: 'solved_geometry',
            fieldPath: 'solvedGeometry.roofPlaneCount',
            explanation: 'Solved geometry mismatch at solvedGeometry.roofPlaneCount.',
          },
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.bayCount',
          originDetail: {
            origin: 'physical_takeoff',
            sourceCategory: 'quantity_takeoff',
            fieldPath: 'quantityTakeoff.roofPlanes.0.bayCount',
            explanation: 'Physical takeoff mismatch at quantityTakeoff.roofPlanes.0.bayCount.',
          },
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.options.overrides.ledgerProfile',
          originDetail: {
            origin: 'commercial_mapping',
            sourceCategory: 'commercial_option',
            fieldPath: 'options.overrides.ledgerProfile',
            explanation: 'Commercial mapping mismatch at options.overrides.ledgerProfile.',
          },
        }),
      ]),
    );
  });

  it('adds location and numeric drift metadata to differences', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.pergolas[0]!.modules[0]!.solvedGeometry.primaryDimensionsM!.length = 6.05;

    const report = compareCommercialDesignInputsV1(left, right);
    const difference = report.differences.find(
      (item) => item.path === 'pergolas.pergola-1.modules.source:0.solvedGeometry.primaryDimensionsM.length',
    );

    expect(report.status).toBe('drift');
    expect(difference).toMatchObject({
      category: 'solved_geometry',
      driftOrigin: 'solved_geometry',
      tolerance: 0.02,
      location: {
        pathSegments: ['pergolas', 'pergola-1', 'modules', 'source:0', 'solvedGeometry', 'primaryDimensionsM', 'length'],
        fieldPath: 'solvedGeometry.primaryDimensionsM.length',
        pergolaId: 'pergola-1',
        moduleKey: 'source:0',
        sourceModuleIndex: 0,
      },
      originDetail: {
        origin: 'solved_geometry',
        sourceCategory: 'solved_geometry',
        fieldPath: 'solvedGeometry.primaryDimensionsM.length',
        explanation: 'Solved geometry mismatch at solvedGeometry.primaryDimensionsM.length.',
      },
    });
    expect(difference?.numericDrift?.delta).toBeCloseTo(0.05, 6);
    expect(difference?.numericDrift?.absoluteDelta).toBeCloseTo(0.05, 6);
    expect(difference?.numericDrift?.tolerance).toBe(0.02);
    expect(report.summary?.byCategory.solved_geometry).toBe(1);
    expect(report.summary?.byDriftOrigin.solved_geometry).toBe(1);
    expect(report.summary?.bySeverity.warning).toBe(1);
    expect(report.summary?.byModule['pergola-1/source:0']).toMatchObject({
      differences: 1,
      warningDifferences: 1,
    });
  });

  it('reports missing pergolas and modules as blocking structure differences', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.pergolas[0]!.modules = [];

    const moduleReport = compareCommercialDesignInputsV1(left, right);

    expect(moduleReport.status).toBe('blocked');
    expect(moduleReport.differences).toContainEqual(
      expect.objectContaining({
        path: 'pergolas.pergola-1.modules.source:0',
        category: 'structure',
        severity: 'blocking',
      }),
    );

    const missingPergola = compareCommercialDesignInputsV1(left, makeInput({ pergolas: [] }));

    expect(missingPergola.status).toBe('blocked');
    expect(missingPergola.differences).toContainEqual(
      expect.objectContaining({
        path: 'pergolas.pergola-1',
        category: 'structure',
        severity: 'blocking',
      }),
    );
  });

  it('blocks when either input has top-level blocked trust', () => {
    const left = makeInput();
    const right = makeInput({ trustStatus: 'blocked' });

    const report = compareCommercialDesignInputsV1(left, right);

    expect(report.status).toBe('blocked');
    expect(report.differences).toContainEqual(
      expect.objectContaining({
        path: 'trustStatus',
        severity: 'blocking',
      }),
    );
  });

  it('allows tolerance overrides by path and category', () => {
    const left = makeInput();
    const right = cloneInput(left);
    right.pergolas[0]!.modules[0]!.solvedGeometry.primaryDimensionsM!.length = 6.05;

    const defaultReport = compareCommercialDesignInputsV1(left, right);
    const overriddenByCategory = compareCommercialDesignInputsV1(left, right, {
      tolerances: { length_m: 0.06 },
    });
    const overriddenByPath = compareCommercialDesignInputsV1(left, right, {
      tolerances: {
        'pergolas.pergola-1.modules.source:0.solvedGeometry.primaryDimensionsM.length': 0.06,
      },
    });

    expect(defaultReport.status).toBe('drift');
    expect(overriddenByCategory.status).toBe('match');
    expect(overriddenByPath.status).toBe('match');
  });

  it('classifies expanded parity drift for secondary dimensions, takeoff rows, flashings, and options', () => {
    const left = makeInput();
    left.pergolas[0]!.modules[0]!.designIntent.dimensions!.secondaryLengthM = 2;
    left.pergolas[0]!.modules[0]!.designIntent.dimensions!.secondaryProjectionM = 1.5;
    left.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterLengthM = 3.2;
    left.pergolas[0]!.modules[0]!.quantityTakeoff.flashings!.byBandM = {
      '201-300': 1.5,
    };
    left.pergolas[0]!.modules[0]!.options = {
      overrides: { ledgerProfile: '150x50' },
      powdercoat: {
        standardColour: 'White',
        isCustom: false,
        customColour: null,
      },
    };

    const right = cloneInput(left);
    right.pergolas[0]!.modules[0]!.designIntent.dimensions!.secondaryLengthM = 2.1;
    right.pergolas[0]!.modules[0]!.designIntent.dimensions!.secondaryProjectionM = 1.6;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.areaM2 = 18.5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterProjectedRunM = 2.9;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterCutLengthM = 3.5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterCount = 12;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterSpacingMm = 590;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterTotalLengthM = 42;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.rafterLengthM = 3.5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.bayCount = 11;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.claddingDownslopeLengthM = 3.1;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.claddingPanelCount = 5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.joinerCount = 12;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofPlanes![0]!.joinerTargetLengthM = 3.1;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.rafters!.totalLengthM = 42;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.rafters!.effectiveRunM = 2.9;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.rafters!.projectedRunM = 2.9;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.beams!.totalBeamLengthM = 7;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.gutters!.totalLengthM = 7;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofCladding!.effectiveRunM = 2.9;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofCladding!.acrylicRequiredDownslopeM = 3.1;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofCladding!.averageDownslopeLengthM = 3.1;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofCladding!.panelCount = 5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.roofCladding!.totalAreaM2 = 18.5;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.joiners!.count = 12;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.joiners!.totalLengthM = 42;
    right.pergolas[0]!.modules[0]!.quantityTakeoff.flashings!.byBandM = {
      '201-300': 1,
      '301-400': 0.5,
    };
    right.pergolas[0]!.modules[0]!.quantityTakeoff.flashings!.byGirthM = {
      '300': 1,
      '400': 0.5,
    };
    right.pergolas[0]!.modules[0]!.quantityTakeoff.flashings!.surfaceAreaM2 = 0.6;
    right.pergolas[0]!.modules[0]!.options = {
      overrides: { ledgerProfile: '200x50' },
      powdercoat: {
        standardColour: 'Black',
        isCustom: true,
        customColour: 'Monument',
      },
    };

    const report = compareCommercialDesignInputsV1(left, right);

    expect(report.status).toBe('drift');
    expect(report.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.designIntent.dimensions.secondaryLengthM',
          driftOrigin: 'authored_intent',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.areaM2',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.rafterProjectedRunM',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.rafterCutLengthM',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.rafterCount',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.claddingDownslopeLengthM',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.claddingPanelCount',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofPlanes.0.joinerTargetLengthM',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.rafters.effectiveRunM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.rafters.effectiveRunM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.rafters.totalLengthM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.rafters.totalLengthM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.beams.totalBeamLengthM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.beams.totalBeamLengthM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.gutters.totalLengthM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.gutters.totalLengthM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofCladding.totalAreaM2',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.roofCladding.totalAreaM2',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.roofCladding.acrylicRequiredDownslopeM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.roofCladding.acrylicRequiredDownslopeM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.joiners.totalLengthM',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.joiners.totalLengthM',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.flashings.byBandM.301-400',
          driftOrigin: 'physical_takeoff',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.flashings.byGirthM.400',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.flashings.byGirthM.400',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.flashings.surfaceAreaM2',
          originDetail: expect.objectContaining({
            fieldPath: 'quantityTakeoff.flashings.surfaceAreaM2',
          }),
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.options.powdercoat.isCustom',
          category: 'commercial_option',
          driftOrigin: 'commercial_mapping',
        }),
        expect.objectContaining({
          path: 'pergolas.pergola-1.modules.source:0.options.overrides.ledgerProfile',
          category: 'commercial_option',
          driftOrigin: 'commercial_mapping',
        }),
      ]),
    );
    expect(report.summary?.byDriftOrigin).toMatchObject({
      authored_intent: 2,
      physical_takeoff: expect.any(Number),
      commercial_mapping: expect.any(Number),
    });
  });

  it('exports the report type from @sp/costing', () => {
    const report: CommercialParityReportV1 = compareCommercialDesignInputsV1(makeInput(), makeInput());

    expect(report.status).toBe('match');
  });
});
