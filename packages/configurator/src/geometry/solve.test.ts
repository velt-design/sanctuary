import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPergolaInteractionAnchors,
  solvePergolaGeometry,
} from '@sp/geometry';
import {
  CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1,
  CUSTOMER_GEOMETRY_FAILURE_CODES_V1,
  CUSTOMER_GEOMETRY_NOTICE_CODES_V1,
  mapPergolaInteractionAnchorsToCustomerV1,
  solveCustomerConfigurationV1,
  type CustomerGeometryRuntimeIdentityV1,
} from '@sp/configurator/geometry';
import {
  normalizeCustomerPergolaConfigurationV1,
  type CustomerPergolaConfigurationV1,
  type CustomerPergolaFamilyV1,
} from '../core';
import { createTestCustomerConfiguration } from '../core/testFixtures';

const geometryMockState = vi.hoisted(() => ({
  mode: 'actual' as
    | 'actual'
    | 'solve_throw'
    | 'solve_failure'
    | 'unsupported_failure'
    | 'unsupported_variant_failure'
    | 'validation_failure'
    | 'validation_unsupported'
    | 'anchor_failure',
  returnedSolve: null as unknown,
  returnedAssembly: null as unknown,
  anchorAssembly: null as unknown,
}));

vi.mock('@sp/geometry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sp/geometry')>();
  return {
    ...actual,
    solvePergolaGeometry: vi.fn((input: Parameters<typeof actual.solvePergolaGeometry>[0]) => {
      if (geometryMockState.mode === 'solve_throw') {
        throw new Error('INTERNAL_THROWN_SOLVER_DETAIL');
      }
      if (geometryMockState.mode === 'solve_failure') {
        return {
          ok: false as const,
          code: 'invalid_dimensions' as const,
          error: 'INTERNAL_SOLVER_DETAIL should never reach the customer',
        };
      }
      if (geometryMockState.mode === 'unsupported_failure') {
        return {
          ok: false as const,
          code: 'unsupported_family' as const,
          error: 'INTERNAL_CAPABILITY_DETAIL should never reach the customer',
        };
      }
      if (geometryMockState.mode === 'unsupported_variant_failure') {
        return {
          ok: false as const,
          code: 'unsupported_variant' as const,
          error: 'INTERNAL_VARIANT_DETAIL should never reach the customer',
        };
      }

      const result = actual.solvePergolaGeometry(input);
      if (!result.ok) return result;
      geometryMockState.returnedSolve = result;
      geometryMockState.returnedAssembly = result.assembly;
      if (geometryMockState.mode === 'validation_failure') {
        return {
          ...result,
          validation: {
            ...result.validation,
            status: 'fail' as const,
            invariants: [
              {
                key: 'internal_fixture',
                status: 'fail' as const,
                message: 'INTERNAL_VALIDATION_DETAIL',
              },
            ],
          },
        };
      }
      if (geometryMockState.mode === 'validation_unsupported') {
        return {
          ...result,
          validation: {
            ...result.validation,
            status: 'unsupported' as const,
            unsupportedReasons: ['INTERNAL_UNSUPPORTED_DETAIL'],
          },
        };
      }
      return result;
    }),
    buildPergolaInteractionAnchors: vi.fn(
      (assembly: Parameters<typeof actual.buildPergolaInteractionAnchors>[0]) => {
        geometryMockState.anchorAssembly = assembly;
        if (geometryMockState.mode === 'anchor_failure') {
          throw new Error('INTERNAL_ANCHOR_DETAIL');
        }
        return actual.buildPergolaInteractionAnchors(assembly);
      },
    ),
  };
});

const RUNTIME_IDENTITY: CustomerGeometryRuntimeIdentityV1 = {
  projectId: 'runtime-project',
  estimateId: 'runtime-estimate',
  designRequestId: 'runtime-design-request',
};

function makeConfiguration(
  family: CustomerPergolaFamilyV1 = 'mono',
  connectionIntent: 'soffit' | 'unsure' = 'soffit',
): CustomerPergolaConfigurationV1 {
  const base = createTestCustomerConfiguration();
  return {
    ...base,
    intent: {
      ...base.intent,
      pergola: {
        ...base.intent.pergola,
        family,
        roof:
          family === 'mono'
            ? {
                system: 'solid_timber_sarking',
                ceilingIntent: 'natural_timber',
              }
            : base.intent.pergola.roof,
        placement: {
          ...base.intent.pergola.placement,
          connectionIntent,
        },
      },
    },
  };
}

beforeEach(() => {
  geometryMockState.mode = 'actual';
  geometryMockState.returnedSolve = null;
  geometryMockState.returnedAssembly = null;
  geometryMockState.anchorAssembly = null;
  vi.clearAllMocks();
});

describe('solveCustomerConfigurationV1', () => {
  it.each(['mono', 'gable', 'hip', 'box'] as const)(
    'produces one ready solved artifact for the %s family',
    (family) => {
      const artifact = solveCustomerConfigurationV1(
        makeConfiguration(family),
        RUNTIME_IDENTITY,
      );

      expect(artifact.status).toBe('ready');
      if (artifact.status !== 'ready') return;
      expect(artifact.geometryInput.family).toBe(family);
      expect(artifact.geometry.validation.status).toBe('pass');
      expect(artifact.geometry.viewerScene.layers.length).toBeGreaterThan(0);
      expect(artifact.geometry.topProjection.shapes.length).toBeGreaterThan(0);
      expect(artifact.geometry.plan).toBeDefined();
      expect(artifact.geometry.section).toBeDefined();
      expect(artifact.interactionAnchors.edges.map((edge) => edge.edgeId)).toEqual([
        'front',
        'left',
        'right',
        'rear',
      ]);
      expect(artifact.messages).toEqual([]);
    },
  );

  it('uses ready only without assumptions and review_required for valid assumed geometry', () => {
    const ready = solveCustomerConfigurationV1(
      makeConfiguration('mono', 'soffit'),
      RUNTIME_IDENTITY,
    );
    const review = solveCustomerConfigurationV1(
      makeConfiguration('mono', 'unsure'),
      RUNTIME_IDENTITY,
    );

    expect(ready.status).toBe('ready');
    expect(review.status).toBe('review_required');
    if (review.status !== 'review_required') return;
    expect(review.geometry.validation.status).toBe('pass');
    expect(review.messages).toContainEqual(
      expect.objectContaining({
        code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.connectionAssumedSoffit,
        kind: 'assumption',
      }),
    );
  });

  it('returns the stable mixed-roof capability block as unsupported without solving', () => {
    const configuration = makeConfiguration();
    const artifact = solveCustomerConfigurationV1(
      {
        ...configuration,
        intent: {
          ...configuration.intent,
          pergola: {
            ...configuration.intent.pergola,
            roof: {
              system: 'mixed',
              tint: 'clear',
              layout: 'central_skylight_standard',
            },
          },
        },
      },
      RUNTIME_IDENTITY,
    );

    expect(artifact).toMatchObject({
      status: 'unsupported',
      messages: [
        {
          code: CUSTOMER_GEOMETRY_CAPABILITY_CODES_V1.mixedRoofPlacementUnavailable,
          kind: 'error',
        },
      ],
    });
    expect(artifact.messages[0]?.message).not.toMatch(/solver|rafter|profile|source/i);
    expect(solvePergolaGeometry).not.toHaveBeenCalled();
    expect(buildPergolaInteractionAnchors).not.toHaveBeenCalled();
  });

  it('keeps the narrow mono-acrylic detailing gap renderable with a redacted assumption', () => {
    const configuration = makeConfiguration();
    const artifact = solveCustomerConfigurationV1(
      {
        ...configuration,
        intent: {
          ...configuration.intent,
          pergola: {
            ...configuration.intent.pergola,
            roof: { system: 'acrylic', tint: 'clear' },
          },
        },
      },
      RUNTIME_IDENTITY,
    );

    expect(artifact).toMatchObject({
      status: 'review_required',
      messages: [
        {
          code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.acrylicRoofDetailingReview,
          kind: 'assumption',
          message:
            'Sanctuary will confirm the acrylic roof detailing for this concept.',
        },
      ],
    });
    expect('geometry' in artifact).toBe(true);
    if (artifact.status !== 'review_required') return;
    expect(artifact.geometry.validation.status).toBe('fail');
    expect(artifact.geometry.assembly).toBe(geometryMockState.returnedAssembly);
    expect(geometryMockState.anchorAssembly).toBe(geometryMockState.returnedAssembly);
    const returnedSolve = geometryMockState.returnedSolve as Extract<
      ReturnType<typeof solvePergolaGeometry>,
      { ok: true }
    >;
    expect(artifact.geometry.viewerScene).toBe(returnedSolve.viewerScene);
    expect(artifact.geometry.topProjection).toBe(returnedSolve.topProjection);
    expect(artifact.geometry.plan).toBe(returnedSolve.plan);
    expect(artifact.geometry.section).toBe(returnedSolve.section);
    expect(artifact.interactionAnchors.edges).toHaveLength(4);
    expect(solvePergolaGeometry).toHaveBeenCalledTimes(1);
    expect(buildPergolaInteractionAnchors).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(artifact.messages)).not.toMatch(
      /mono_acrylic|covering_inputs|cost(?:ing)?/i,
    );
  });

  it('keeps an unrelated validation failure invalid for mono acrylic', () => {
    geometryMockState.mode = 'validation_failure';
    const configuration = makeConfiguration();
    const artifact = solveCustomerConfigurationV1(
      {
        ...configuration,
        intent: {
          ...configuration.intent,
          pergola: {
            ...configuration.intent.pergola,
            roof: { system: 'acrylic', tint: 'clear' },
          },
        },
      },
      RUNTIME_IDENTITY,
    );

    expect(artifact).toMatchObject({
      status: 'invalid',
      messages: [
        {
          code: CUSTOMER_GEOMETRY_FAILURE_CODES_V1.validationFailed,
          kind: 'error',
        },
      ],
    });
    expect(JSON.stringify(artifact.messages)).not.toContain(
      'INTERNAL_VALIDATION_DETAIL',
    );
    expect(buildPergolaInteractionAnchors).not.toHaveBeenCalled();
  });

  it('keeps identity and customer anchor IDs stable across finish-only changes', () => {
    const blackConfiguration = makeConfiguration();
    const whiteConfiguration: CustomerPergolaConfigurationV1 = {
      ...blackConfiguration,
      intent: {
        ...blackConfiguration.intent,
        pergola: {
          ...blackConfiguration.intent.pergola,
          frame: { finish: 'white', otherColourName: null },
        },
      },
    };
    const black = solveCustomerConfigurationV1(
      blackConfiguration,
      RUNTIME_IDENTITY,
    );
    const white = solveCustomerConfigurationV1(
      whiteConfiguration,
      RUNTIME_IDENTITY,
    );

    expect(black.status).toBe('ready');
    expect(white.status).toBe('ready');
    if (black.status !== 'ready' || white.status !== 'ready') return;
    expect(white.geometryInput).toEqual(black.geometryInput);
    expect(white.geometry.config).toEqual(black.geometry.config);
    expect(white.geometry.assembly).toEqual(black.geometry.assembly);
    expect(white.interactionAnchors).toEqual(black.interactionAnchors);
    expect(white.interactionAnchors.edges.map((edge) => edge.id)).toEqual([
      'pergola-1:edge:front',
      'pergola-1:edge:left',
      'pergola-1:edge:right',
      'pergola-1:edge:rear',
    ]);
    expect(JSON.stringify(white.interactionAnchors)).not.toContain('runtime-project');
    expect(JSON.stringify(white.interactionAnchors)).not.toContain('runtime-estimate');
  });

  it('returns one-solve scene/view parity and builds anchors from that exact assembly', () => {
    const sourceConfiguration = {
      ...makeConfiguration(),
      revision: 1.4,
    };
    const artifact = solveCustomerConfigurationV1(
      sourceConfiguration,
      RUNTIME_IDENTITY,
    );

    expect(artifact.status).toBe('ready');
    if (artifact.status !== 'ready') return;
    expect(artifact.configuration).toEqual(
      normalizeCustomerPergolaConfigurationV1(sourceConfiguration),
    );
    expect(solvePergolaGeometry).toHaveBeenCalledTimes(1);
    expect(buildPergolaInteractionAnchors).toHaveBeenCalledTimes(1);
    expect(geometryMockState.anchorAssembly).toBe(geometryMockState.returnedAssembly);
    expect(artifact.geometry.assembly).toBe(geometryMockState.returnedAssembly);

    const returnedSolve = geometryMockState.returnedSolve as Extract<
      ReturnType<typeof solvePergolaGeometry>,
      { ok: true }
    >;
    expect(artifact.geometry.config).toBe(returnedSolve.config);
    expect(artifact.geometry.assembly).toBe(returnedSolve.assembly);
    expect(artifact.geometry.viewerScene).toBe(returnedSolve.viewerScene);
    expect(artifact.geometry.topProjection).toBe(returnedSolve.topProjection);
    expect(artifact.geometry.plan).toBe(returnedSolve.plan);
    expect(artifact.geometry.section).toBe(returnedSolve.section);
    expect(artifact.geometry.validation).toBe(returnedSolve.validation);

    const physicalAnchors = buildPergolaInteractionAnchors(artifact.geometry.assembly);
    expect(artifact.interactionAnchors).toEqual(
      mapPergolaInteractionAnchorsToCustomerV1('pergola-1', physicalAnchors),
    );
  });

  it.each([
    [
      'solve_throw',
      'invalid',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.solveFailed,
      'INTERNAL_THROWN_SOLVER_DETAIL',
    ],
    [
      'solve_failure',
      'invalid',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.solveFailed,
      'INTERNAL_SOLVER_DETAIL',
    ],
    [
      'unsupported_failure',
      'unsupported',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.capabilityUnavailable,
      'INTERNAL_CAPABILITY_DETAIL',
    ],
    [
      'unsupported_variant_failure',
      'unsupported',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.capabilityUnavailable,
      'INTERNAL_VARIANT_DETAIL',
    ],
    [
      'validation_failure',
      'invalid',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.validationFailed,
      'INTERNAL_VALIDATION_DETAIL',
    ],
    [
      'validation_unsupported',
      'unsupported',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.validationUnsupported,
      'INTERNAL_UNSUPPORTED_DETAIL',
    ],
    [
      'anchor_failure',
      'invalid',
      CUSTOMER_GEOMETRY_FAILURE_CODES_V1.interactionAnchorsFailed,
      'INTERNAL_ANCHOR_DETAIL',
    ],
  ] as const)(
    'maps %s to a stable customer-safe %s contract',
    (mode, status, code, internalText) => {
      geometryMockState.mode = mode;
      const artifact = solveCustomerConfigurationV1(
        makeConfiguration(),
        RUNTIME_IDENTITY,
      );

      expect(artifact).toMatchObject({
        status,
        messages: [{ code, kind: 'error' }],
      });
      expect(JSON.stringify(artifact.messages)).not.toContain(internalText);
    },
  );

  it('accepts a caller-owned review_required artifact as the last renderable fallback', () => {
    const configuration = makeConfiguration();
    const lastReadyArtifact = solveCustomerConfigurationV1(
      {
        ...configuration,
        intent: {
          ...configuration.intent,
          pergola: {
            ...configuration.intent.pergola,
            roof: { system: 'acrylic', tint: 'clear' },
          },
        },
      },
      RUNTIME_IDENTITY,
    );
    expect(lastReadyArtifact.status).toBe('review_required');
    if (lastReadyArtifact.status !== 'review_required') return;

    geometryMockState.mode = 'solve_failure';
    const artifact = solveCustomerConfigurationV1(
      makeConfiguration(),
      RUNTIME_IDENTITY,
      { lastReadyArtifact },
    );

    expect(artifact.status).toBe('invalid');
    if (artifact.status !== 'invalid') return;
    expect(artifact.lastReadyArtifact).toBe(lastReadyArtifact);
  });
});
