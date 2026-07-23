const COSTING_CONFIGURATION_NAME_MIN = 3;
export const COSTING_CONFIGURATION_NAME_MAX = 80;
const COSTING_CONFIGURATION_PURPOSE_MIN = 3;
export const COSTING_CONFIGURATION_PURPOSE_MAX = 500;

export type CostingConfigurationMetadata = {
  name: string;
  purpose: string;
};

export type CostingConfigurationMetadataIssue = {
  path: 'name' | 'purpose';
  message: string;
};

export function validateCostingConfigurationMetadata(
  candidate: Partial<CostingConfigurationMetadata>,
): { ok: true; value: CostingConfigurationMetadata } | {
  ok: false;
  issues: CostingConfigurationMetadataIssue[];
} {
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const purpose = typeof candidate.purpose === 'string' ? candidate.purpose.trim() : '';
  const issues: CostingConfigurationMetadataIssue[] = [];

  if (name.length < COSTING_CONFIGURATION_NAME_MIN || name.length > COSTING_CONFIGURATION_NAME_MAX) {
    issues.push({
      path: 'name',
      message: `Use between ${COSTING_CONFIGURATION_NAME_MIN} and ${COSTING_CONFIGURATION_NAME_MAX} characters.`,
    });
  }
  if (
    purpose.length < COSTING_CONFIGURATION_PURPOSE_MIN
    || purpose.length > COSTING_CONFIGURATION_PURPOSE_MAX
  ) {
    issues.push({
      path: 'purpose',
      message: `Use between ${COSTING_CONFIGURATION_PURPOSE_MIN} and ${COSTING_CONFIGURATION_PURPOSE_MAX} characters.`,
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: { name, purpose } };
}
