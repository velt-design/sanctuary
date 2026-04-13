import type { GeometryConfig, HouseAttachmentStrategy } from '../contracts';
import { buildHouseFootprintPolygon } from '../footprints';
import type { SolveAssembly3DErrorCode } from '../solve.types';
import type { CanonicalAssembly3D } from '../validation/canonical';
import { makeBoxConfig, makeGableConfig, makeMonoConfig } from './builders';
import {
  BOX_ATTACHED_STANDARD_GOLDEN,
  GABLE_ATTACHED_STANDARD_GOLDEN,
  GABLE_FREESTANDING_STANDARD_GOLDEN,
  MONO_ATTACHED_FASCIA_TOWARD_STANDARD_GOLDEN,
  MONO_ATTACHED_SOFFIT_AWAY_STANDARD_GOLDEN,
  MONO_FREESTANDING_STANDARD_GOLDEN,
} from './supportedGoldens';

export type GeometryFixtureCase =
  | {
      id: string;
      kind: 'supported';
      config: GeometryConfig;
      expectedAssembly: CanonicalAssembly3D;
    }
  | {
      id: string;
      kind: 'unsupported';
      config: GeometryConfig;
      expectedErrorCode: SolveAssembly3DErrorCode;
      expectedMessageIncludes: string;
    };

function resolveFixtureAttachmentStrategy(config: GeometryConfig): HouseAttachmentStrategy {
  if (config.connection.type === 'freestanding') return 'none';
  if (config.connection.type === 'wall') return 'facade_ledger';
  if (config.connection.type === 'fascia') return 'fascia_under_gutter';
  return 'soffit_brackets';
}

function withSupportedHouseContext(config: GeometryConfig): GeometryConfig {
  const attachmentStrategy = resolveFixtureAttachmentStrategy(config);
  if (config.connection.type === 'freestanding') {
    return {
      ...config,
      houseContext: {
        ...config.houseContext,
        footprint: null,
        model: null,
        attachmentStrategy,
      },
    };
  }

  const footprint =
    config.houseContext.footprint ??
    buildHouseFootprintPolygon({
      pergolaWidthMm: config.dimensions.lengthMm,
      pergolaDepthMm: config.dimensions.projectionMm,
    });
  const eaveHeightMm =
    config.structural.heights.referenceUndersideMm ??
    config.structural.heights.houseUndersideMm ??
    2400;

  return {
    ...config,
    houseContext: {
      ...config.houseContext,
      footprint,
      attachmentStrategy,
      model: {
        footprint,
        storeyMode: 'single_storey',
        wallConstruction: 'timber_frame',
        roofForm: 'hipped',
        eaveHeightMm,
        wallHeightMm: eaveHeightMm,
        roofPitchDeg: 25,
        attachmentStrategy,
        eave: {
          soffitDepthMm: 450,
          fasciaHeightMm: 180,
          gutterWidthMm: 125,
          gutterDepthMm: 90,
          gutterProjectionMm: 125,
          eaveOverhangMm: 450,
        },
      },
    },
  };
}

const FIXTURES: GeometryFixtureCase[] = [
  {
    id: 'mono_attached_soffit_away_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeMonoConfig()),
    expectedAssembly: MONO_ATTACHED_SOFFIT_AWAY_STANDARD_GOLDEN,
  },
  {
    id: 'mono_attached_fascia_toward_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeMonoConfig({
      connection: {
        type: 'fascia',
        attachmentSide: 'rear',
      },
      roof: {
        fallDirection: 'negativeY',
      },
      structural: {
        heights: {
          houseUndersideMm: 2137,
          outerUndersideMm: 2400,
          referenceUndersideMm: 2137,
        },
      },
    })),
    expectedAssembly: MONO_ATTACHED_FASCIA_TOWARD_STANDARD_GOLDEN,
  },
  {
    id: 'mono_freestanding_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeMonoConfig({
      connection: {
        type: 'freestanding',
        attachmentSide: 'rear',
      },
      supports: {
        postCount: 4,
      },
      structural: {
        heights: {
          houseUndersideMm: 2400,
          outerUndersideMm: 2137,
          referenceUndersideMm: 2400,
        },
      },
    })),
    expectedAssembly: MONO_FREESTANDING_STANDARD_GOLDEN,
  },
  {
    id: 'gable_attached_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeGableConfig()),
    expectedAssembly: GABLE_ATTACHED_STANDARD_GOLDEN,
  },
  {
    id: 'gable_freestanding_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeGableConfig({
      connection: {
        type: 'freestanding',
        attachmentSide: 'rear',
      },
      gable: {
        houseEaveGutterMode: 'our',
        outerEaveGutterMode: 'our',
      },
      supports: {
        postCount: 4,
      },
    })),
    expectedAssembly: GABLE_FREESTANDING_STANDARD_GOLDEN,
  },
  {
    id: 'box_attached_standard',
    kind: 'supported',
    config: withSupportedHouseContext(makeBoxConfig()),
    expectedAssembly: BOX_ATTACHED_STANDARD_GOLDEN,
  },
  {
    id: 'mono_overhang_unsupported',
    kind: 'unsupported',
    config: makeMonoConfig({
      roof: {
        overhangMm: 250,
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'overhang',
  },
  {
    id: 'mono_separate_gutter_unsupported',
    kind: 'unsupported',
    config: makeMonoConfig({
      structural: {
        drainage: {
          gutterAssemblyMode: 'separate',
        },
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'separate-gutter mono',
  },
  {
    id: 'gable_incompatible_end_frames_unsupported',
    kind: 'unsupported',
    config: makeGableConfig({
      connection: {
        type: 'freestanding',
        attachmentSide: 'rear',
      },
      gable: {
        ridgePositionMm: 2000,
        endFramesMode: 'outer_end_only',
        houseEaveGutterMode: 'our',
        outerEaveGutterMode: 'our',
      },
      supports: {
        postCount: 4,
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'both-ends for freestanding',
  },
  {
    id: 'gable_asymmetrical_eaves_unsupported',
    kind: 'unsupported',
    config: makeGableConfig({
      structural: {
        heights: {
          houseUndersideMm: 2700,
          outerUndersideMm: 2600,
          referenceUndersideMm: 2700,
        },
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'symmetrical eave underside heights',
  },
  {
    id: 'box_freestanding_unsupported',
    kind: 'unsupported',
    config: makeBoxConfig({
      connection: {
        type: 'freestanding',
        attachmentSide: 'rear',
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'attached box-perimeter layouts only',
  },
  {
    id: 'box_nonbaseline_gutters_unsupported',
    kind: 'unsupported',
    config: makeBoxConfig({
      box: {
        houseEdgeGutterMode: 'our',
        farEdgeGutterMode: 'our',
      },
    }),
    expectedErrorCode: 'unsupported_variant',
    expectedMessageIncludes: 'baseline box gutter configuration',
  },
];

export function listGeometryFixtureCases(): GeometryFixtureCase[] {
  return FIXTURES.slice();
}

export function getGeometryFixtureCase(id: string): GeometryFixtureCase | null {
  return FIXTURES.find((fixture) => fixture.id === id) ?? null;
}
