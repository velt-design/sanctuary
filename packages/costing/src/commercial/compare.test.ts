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
      roofPlanes: [{ id: 'plane-1', areaM2: 18, bayCount: 10, rafterLengthM: 3 }],
      posts: { count: 2, cutHeightM: 2.4, profile: '90x90' },
      rafters: { count: 11, spacingMm: 600, cutLengthM: 3, profile: '100x50' },
      beams: {
        ledgerLengthM: 6,
        frontBeamLengthM: 6,
        ridgeLengthM: null,
        tieBeamLengthM: null,
        ledgerProfile: '150x50',
        frontBeamProfile: '150x50',
        ridgeProfile: null,
      },
      gutters: {
        ourGutterLengthM: 6,
        houseGutterLengthM: 0,
        downpipeCount: 2,
        downpipeJoinCount: 1,
        downpipeElbowCount: 3,
      },
      roofCladding: {
        acrylicAreaM2: 18,
        timberAreaM2: 0,
        sheetCount: 4,
        joinerRuns: 11,
      },
      flashings: {
        totalLengthM: 1.5,
        byBandM: { '201-300': 1.5 },
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
        expect.objectContaining({ path: 'pergolas.pergola-1.modules.source:0.trustStatus', category: 'trust' }),
        expect.objectContaining({ path: 'pergolas.pergola-1.modules.source:0.designIntent.roofMaterial', category: 'design_intent' }),
        expect.objectContaining({ path: 'pergolas.pergola-1.modules.source:0.quantityTakeoff.posts.count', category: 'quantity_takeoff' }),
      ]),
    );
    expect(report.counts.warningDifferences).toBeGreaterThanOrEqual(4);
    expect(report.summary?.byCategory).toMatchObject({
      site_commercial: 1,
      trust: 1,
      design_intent: 1,
      quantity_takeoff: 1,
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
      tolerance: 0.02,
      location: {
        pathSegments: ['pergolas', 'pergola-1', 'modules', 'source:0', 'solvedGeometry', 'primaryDimensionsM', 'length'],
        fieldPath: 'solvedGeometry.primaryDimensionsM.length',
        pergolaId: 'pergola-1',
        moduleKey: 'source:0',
        sourceModuleIndex: 0,
      },
    });
    expect(difference?.numericDrift?.delta).toBeCloseTo(0.05, 6);
    expect(difference?.numericDrift?.absoluteDelta).toBeCloseTo(0.05, 6);
    expect(difference?.numericDrift?.tolerance).toBe(0.02);
    expect(report.summary?.byCategory.solved_geometry).toBe(1);
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

  it('exports the report type from @sp/costing', () => {
    const report: CommercialParityReportV1 = compareCommercialDesignInputsV1(makeInput(), makeInput());

    expect(report.status).toBe('match');
  });
});
