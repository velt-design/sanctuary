import {
  migrateCustomerPergolaConfiguration,
  normalizeCustomerPergolaConfigurationV1,
  parseCustomerPergolaConfigurationV1,
  serializeCustomerPergolaConfigurationV1,
  type CustomerPergolaConfigurationV1,
} from '@sp/configurator/core';

export const CONFIGURATOR_STORAGE_KEY = 'sanctuary.pergola-config.v1';
const CONFIGURATOR_STORAGE_VERSION = 'sanctuary.pergola-config.v1' as const;

export type ConfiguratorStorage = Pick<Storage, 'getItem' | 'setItem'>;

type StoredCustomerPergolaConfigurationEnvelopeV1 = {
  storageVersion: typeof CONFIGURATOR_STORAGE_VERSION;
  savedAt: string;
  document: CustomerPergolaConfigurationV1;
};

type StoredConfigurationReadResult =
  | {
      status: 'current';
      envelope: StoredCustomerPergolaConfigurationEnvelopeV1;
      canonicalSerialized: string;
      needsCanonicalWrite: boolean;
    }
  | { status: 'empty' }
  | { status: 'future-version'; storageVersion: string; preservedRaw: string }
  | { status: 'invalid'; preservedRaw: string };

const STORAGE_VERSION_PATTERN = /^sanctuary\.pergola-config\.v(\d+)$/;
const CURRENT_STORAGE_VERSION = 1;
const ENVELOPE_KEYS = ['document', 'savedAt', 'storageVersion'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString() === value;
}

function hasExactEnvelopeKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === ENVELOPE_KEYS.length
    && keys.every((key, index) => key === ENVELOPE_KEYS[index]);
}

function canonicalizeDocument(
  document: CustomerPergolaConfigurationV1,
): CustomerPergolaConfigurationV1 {
  const normalized = normalizeCustomerPergolaConfigurationV1(document);
  return parseCustomerPergolaConfigurationV1(
    JSON.parse(serializeCustomerPergolaConfigurationV1(normalized)) as unknown,
  );
}

export function serializeStoredCustomerPergolaConfigurationEnvelopeV1(
  document: CustomerPergolaConfigurationV1,
  savedAt: string,
): string {
  if (!isCanonicalIsoTimestamp(savedAt)) {
    throw new Error('Configurator envelope savedAt must be a canonical ISO timestamp.');
  }
  const envelope: StoredCustomerPergolaConfigurationEnvelopeV1 = {
    storageVersion: CONFIGURATOR_STORAGE_VERSION,
    savedAt,
    document: canonicalizeDocument(document),
  };
  return JSON.stringify(envelope);
}

export function readStoredCustomerPergolaConfiguration(
  serialized: string | null,
): StoredConfigurationReadResult {
  if (serialized === null) return { status: 'empty' };

  let raw: unknown;
  try {
    raw = JSON.parse(serialized) as unknown;
  } catch {
    return { status: 'invalid', preservedRaw: serialized };
  }
  if (!isRecord(raw)) return { status: 'invalid', preservedRaw: serialized };

  const storageVersion = raw.storageVersion;
  if (typeof storageVersion === 'string' && storageVersion !== CONFIGURATOR_STORAGE_VERSION) {
    const match = storageVersion.match(STORAGE_VERSION_PATTERN);
    const version = match ? Number(match[1]) : null;
    if (version !== null && version > CURRENT_STORAGE_VERSION) {
      return { status: 'future-version', storageVersion, preservedRaw: serialized };
    }
    return { status: 'invalid', preservedRaw: serialized };
  }

  if (
    storageVersion !== CONFIGURATOR_STORAGE_VERSION
    || !hasExactEnvelopeKeys(raw)
    || !isCanonicalIsoTimestamp(raw.savedAt)
  ) {
    return { status: 'invalid', preservedRaw: serialized };
  }

  const migrated = migrateCustomerPergolaConfiguration(raw.document);
  if (migrated.status !== 'current') {
    return migrated.status === 'future-version'
      ? {
          status: 'future-version',
          storageVersion: migrated.schemaVersion,
          preservedRaw: serialized,
        }
      : { status: 'invalid', preservedRaw: serialized };
  }

  const canonicalSerialized = serializeStoredCustomerPergolaConfigurationEnvelopeV1(
    migrated.configuration,
    raw.savedAt,
  );
  return {
    status: 'current',
    envelope: JSON.parse(canonicalSerialized) as StoredCustomerPergolaConfigurationEnvelopeV1,
    canonicalSerialized,
    needsCanonicalWrite: canonicalSerialized !== serialized,
  };
}

export function compareConfigurationFreshness(
  left: CustomerPergolaConfigurationV1,
  right: CustomerPergolaConfigurationV1,
): number {
  const timestampDifference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
  if (timestampDifference !== 0) return timestampDifference;
  return left.revision - right.revision;
}
