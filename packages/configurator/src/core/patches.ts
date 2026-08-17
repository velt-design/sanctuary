import {
  CUSTOMER_CONFIGURATION_PATCH_V1,
  type CustomerConfigurationPatchV1,
  type CustomerConfigurationSeedV1,
  type CustomerEdgeTreatmentV1,
  type CustomerPergolaConfigurationV1,
} from './contracts';
import { normalizeCustomerPergolaConfigurationV1 } from './normalize';
import { parseCustomerPergolaConfigurationV1 } from './parser';

export type ApplyCustomerConfigurationPatchOptions = {
  updatedAt: string;
};

function mergeEdgeTreatments(
  current: CustomerEdgeTreatmentV1[],
  patch: CustomerEdgeTreatmentV1[] | undefined,
): CustomerEdgeTreatmentV1[] {
  if (!patch) return current;
  const byEdge = new Map(current.map((treatment) => [treatment.edgeId, treatment]));
  for (const treatment of patch) byEdge.set(treatment.edgeId, treatment);
  return [...byEdge.values()];
}

export function applyCustomerConfigurationPatchV1(
  configuration: CustomerPergolaConfigurationV1,
  patch: CustomerConfigurationPatchV1,
  { updatedAt }: ApplyCustomerConfigurationPatchOptions,
): CustomerPergolaConfigurationV1 {
  if (patch.schemaVersion !== CUSTOMER_CONFIGURATION_PATCH_V1) {
    throw new Error(`Unsupported customer configuration patch: ${patch.schemaVersion}`);
  }

  const currentPergola = configuration.intent.pergola;
  const currentSite = configuration.intent.site;
  const pergolaPatch = patch.pergola;
  const sitePatch = patch.site;
  const next = normalizeCustomerPergolaConfigurationV1({
    ...configuration,
    revision: configuration.revision + 1,
    updatedAt,
    intent: {
      pergola: {
        ...currentPergola,
        ...pergolaPatch,
        dimensions: {
          ...currentPergola.dimensions,
          ...pergolaPatch?.dimensions,
        },
        placement: {
          ...currentPergola.placement,
          ...pergolaPatch?.placement,
        },
        frame: {
          ...currentPergola.frame,
          ...pergolaPatch?.frame,
        },
        edgeTreatments: mergeEdgeTreatments(
          currentPergola.edgeTreatments,
          pergolaPatch?.edgeTreatments,
        ),
        lighting: {
          ...currentPergola.lighting,
          ...pergolaPatch?.lighting,
        },
      },
      site: {
        ...currentSite,
        ...sitePatch,
        house: {
          ...currentSite.house,
          ...sitePatch?.house,
        },
      },
    },
  });
  return parseCustomerPergolaConfigurationV1(next);
}

export function applyCustomerConfigurationSeedV1(
  configuration: CustomerPergolaConfigurationV1,
  seed: CustomerConfigurationSeedV1,
  options: ApplyCustomerConfigurationPatchOptions,
): CustomerPergolaConfigurationV1 {
  const patched = applyCustomerConfigurationPatchV1(configuration, seed.patch, options);
  return parseCustomerPergolaConfigurationV1({
    ...patched,
    source: {
      kind: seed.source,
      sourcePath: configuration.source.sourcePath,
      sourceSlug: seed.sourceSlug,
    },
  });
}
