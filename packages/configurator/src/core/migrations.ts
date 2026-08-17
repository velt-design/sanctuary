import {
  CUSTOMER_PERGOLA_CONFIGURATION_V1,
  type CustomerPergolaConfigurationV1,
} from './contracts';
import {
  type CustomerConfigurationParseIssue,
  safeParseCustomerPergolaConfigurationV1,
} from './parser';

export type CustomerConfigurationMigrationResult =
  | {
      status: 'current';
      configuration: CustomerPergolaConfigurationV1;
      migrated: false;
    }
  | {
      status: 'future-version';
      schemaVersion: string;
      raw: unknown;
    }
  | {
      status: 'invalid';
      issues: CustomerConfigurationParseIssue[];
      raw: unknown;
    };

const VERSION_PATTERN = /^customer_pergola_configuration\.v(\d+)$/;
const CURRENT_VERSION = 1;

function invalidVersionIssue(schemaVersion: unknown): CustomerConfigurationParseIssue {
  return {
    code: 'invalid_value',
    path: '$.schemaVersion',
    message: typeof schemaVersion === 'string'
      ? `Unsupported schema version "${schemaVersion}".`
      : 'Expected a schema version string.',
  };
}

export function migrateCustomerPergolaConfiguration(
  raw: unknown,
): CustomerConfigurationMigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { status: 'invalid', issues: [invalidVersionIssue(undefined)], raw };
  }

  const schemaVersion = (raw as Record<string, unknown>).schemaVersion;
  if (schemaVersion === CUSTOMER_PERGOLA_CONFIGURATION_V1) {
    const parsed = safeParseCustomerPergolaConfigurationV1(raw);
    return parsed.success
      ? { status: 'current', configuration: parsed.data, migrated: false }
      : { status: 'invalid', issues: parsed.issues, raw };
  }

  if (typeof schemaVersion === 'string') {
    const match = schemaVersion.match(VERSION_PATTERN);
    const version = match ? Number(match[1]) : null;
    if (version !== null && version > CURRENT_VERSION) {
      return { status: 'future-version', schemaVersion, raw };
    }
  }

  return { status: 'invalid', issues: [invalidVersionIssue(schemaVersion)], raw };
}

export function migrateSerializedCustomerPergolaConfiguration(
  serialized: string,
): CustomerConfigurationMigrationResult {
  try {
    return migrateCustomerPergolaConfiguration(JSON.parse(serialized));
  } catch {
    return {
      status: 'invalid',
      issues: [{
        code: 'invalid_value',
        path: '$',
        message: 'Expected valid JSON.',
      }],
      raw: serialized,
    };
  }
}
