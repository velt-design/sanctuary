import {
  buildPergolaInteractionAnchors,
  solvePergolaGeometry,
} from '@sp/geometry';
import type { CustomerPergolaConfigurationV1 } from '../core';
import { customerConfigurationToPergolaGeometryInputV1 } from './adapter';
import {
  CUSTOMER_GEOMETRY_FAILURE_CODES_V1,
  CUSTOMER_GEOMETRY_NOTICE_CODES_V1,
  type ConfiguratorSolvedArtifactV1,
  type ConfiguratorUnavailableArtifactV1,
  type CustomerGeometryRuntimeIdentityV1,
  type CustomerSafeConfiguratorMessageV1,
  type SolveCustomerConfigurationOptionsV1,
} from './contracts';
import { mapPergolaInteractionAnchorsToCustomerV1 } from './interactionAnchors';

const FAILURE_MESSAGES = {
  solveFailed:
    'We could not build this concept geometry. Your choices are retained for Sanctuary review.',
  capabilityUnavailable:
    'This concept geometry is not supported yet. Your choices are retained for Sanctuary review.',
  validationFailed:
    'This concept did not pass geometry validation. Your choices are retained for Sanctuary review.',
  validationUnsupported:
    'This concept cannot be validated by the current geometry capability. Your choices are retained for Sanctuary review.',
  interactionAnchorsFailed:
    'This concept could not prepare its interaction positions. Your choices are retained for Sanctuary review.',
} as const;

const ACRYLIC_ROOF_DETAILING_MESSAGE =
  'Sanctuary will confirm the acrylic roof detailing for this concept.';
const MONO_ACRYLIC_DETAILING_INVARIANT = 'mono_acrylic.covering_inputs';

function isMonoAcrylicDetailingReview(
  geometryInput: Parameters<typeof solvePergolaGeometry>[0],
  validation: Extract<
    ReturnType<typeof solvePergolaGeometry>,
    { ok: true }
  >['validation'],
): boolean {
  if (
    geometryInput.family !== 'mono' ||
    geometryInput.roof?.material !== 'acrylic' ||
    validation.status !== 'fail'
  ) {
    return false;
  }
  const failedInvariants = validation.invariants.filter(
    (invariant) => invariant.status === 'fail',
  );
  return (
    failedInvariants.length === 1 &&
    failedInvariants[0]?.key === MONO_ACRYLIC_DETAILING_INVARIANT &&
    validation.unsupportedReasons.length === 0 &&
    validation.fixtureComparisons.every(
      (comparison) => comparison.status === 'match',
    )
  );
}

function unavailableArtifact(
  status: ConfiguratorUnavailableArtifactV1['status'],
  configuration: CustomerPergolaConfigurationV1,
  message: CustomerSafeConfiguratorMessageV1,
  options: SolveCustomerConfigurationOptionsV1,
): ConfiguratorUnavailableArtifactV1 {
  return {
    status,
    configuration,
    messages: [message],
    ...(options.lastReadyArtifact
      ? { lastReadyArtifact: options.lastReadyArtifact }
      : {}),
  };
}

function isUnsupportedSolveFailure(code: string): boolean {
  return code === 'unsupported_family' || code === 'unsupported_variant';
}

/**
 * Solve one normalized customer configuration into one internally consistent
 * configurator artifact. This function owns no persistence or fallback state.
 */
export function solveCustomerConfigurationV1(
  sourceConfiguration: CustomerPergolaConfigurationV1,
  identity: CustomerGeometryRuntimeIdentityV1,
  options: SolveCustomerConfigurationOptionsV1 = {},
): ConfiguratorSolvedArtifactV1 {
  const adapterResult = customerConfigurationToPergolaGeometryInputV1(
    sourceConfiguration,
    identity,
  );
  if (!adapterResult.ok) {
    return unavailableArtifact(
      'unsupported',
      adapterResult.configuration,
      {
        code: adapterResult.code,
        kind: 'error',
        message: adapterResult.message,
      },
      options,
    );
  }

  let solveResult: ReturnType<typeof solvePergolaGeometry>;
  try {
    solveResult = solvePergolaGeometry(adapterResult.geometryInput);
  } catch {
    return unavailableArtifact(
      'invalid',
      adapterResult.configuration,
      {
        code: CUSTOMER_GEOMETRY_FAILURE_CODES_V1.solveFailed,
        kind: 'error',
        message: FAILURE_MESSAGES.solveFailed,
      },
      options,
    );
  }

  if (!solveResult.ok) {
    const unsupported = isUnsupportedSolveFailure(solveResult.code);
    return unavailableArtifact(
      unsupported ? 'unsupported' : 'invalid',
      adapterResult.configuration,
      {
        code: unsupported
          ? CUSTOMER_GEOMETRY_FAILURE_CODES_V1.capabilityUnavailable
          : CUSTOMER_GEOMETRY_FAILURE_CODES_V1.solveFailed,
        kind: 'error',
        message: unsupported
          ? FAILURE_MESSAGES.capabilityUnavailable
          : FAILURE_MESSAGES.solveFailed,
      },
      options,
    );
  }

  const monoAcrylicDetailingReview = isMonoAcrylicDetailingReview(
    adapterResult.geometryInput,
    solveResult.validation,
  );
  if (
    solveResult.validation.status !== 'pass' &&
    !monoAcrylicDetailingReview
  ) {
    const unsupported = solveResult.validation.status === 'unsupported';
    return unavailableArtifact(
      unsupported ? 'unsupported' : 'invalid',
      adapterResult.configuration,
      {
        code: unsupported
          ? CUSTOMER_GEOMETRY_FAILURE_CODES_V1.validationUnsupported
          : CUSTOMER_GEOMETRY_FAILURE_CODES_V1.validationFailed,
        kind: 'error',
        message: unsupported
          ? FAILURE_MESSAGES.validationUnsupported
          : FAILURE_MESSAGES.validationFailed,
      },
      options,
    );
  }

  let interactionAnchors: ReturnType<
    typeof mapPergolaInteractionAnchorsToCustomerV1
  >;
  try {
    interactionAnchors = mapPergolaInteractionAnchorsToCustomerV1(
      adapterResult.identifiers.pergolaId,
      buildPergolaInteractionAnchors(solveResult.assembly),
    );
  } catch {
    return unavailableArtifact(
      'invalid',
      adapterResult.configuration,
      {
        code: CUSTOMER_GEOMETRY_FAILURE_CODES_V1.interactionAnchorsFailed,
        kind: 'error',
        message: FAILURE_MESSAGES.interactionAnchorsFailed,
      },
      options,
    );
  }

  const messages: CustomerSafeConfiguratorMessageV1[] = adapterResult.notices.map(
    (notice) => ({
      code: notice.code,
      kind: 'assumption',
      message: notice.message,
    }),
  );
  if (monoAcrylicDetailingReview) {
    messages.push({
      code: CUSTOMER_GEOMETRY_NOTICE_CODES_V1.acrylicRoofDetailingReview,
      kind: 'assumption',
      message: ACRYLIC_ROOF_DETAILING_MESSAGE,
    });
  }
  const status = messages.length === 0 ? 'ready' : 'review_required';

  return {
    status,
    configuration: adapterResult.configuration,
    geometryInput: adapterResult.geometryInput,
    geometry: {
      config: solveResult.config,
      assembly: solveResult.assembly,
      viewerScene: solveResult.viewerScene,
      topProjection: solveResult.topProjection,
      plan: solveResult.plan,
      section: solveResult.section,
      validation: solveResult.validation,
    },
    interactionAnchors,
    messages,
  };
}
