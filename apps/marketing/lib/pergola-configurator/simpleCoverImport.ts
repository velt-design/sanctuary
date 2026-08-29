import {
  createDefaultCustomerPergolaConfigurationV1,
  normalizeCustomerPergolaConfigurationV1,
  parseCustomerPergolaConfigurationV1,
  type CustomerConnectionIntentV1,
  type CustomerPergolaConfigurationV1,
} from '@sp/configurator/core';

export const SIMPLE_COVER_HANDOFF_STORAGE_KEY = 'sanctuary.simple-cover-handoff.v1';

type SimpleCoverImportCandidateV1 = {
  schemaVersion: 'simple-cover-handoff.v1';
  input: {
    widthMm: number;
    projectionMm: number;
    level: 'ground' | 'elevated';
    connection: 'fascia' | 'facade' | 'soffit';
  };
};

const HANDOFF_KEYS = [
  'calculationRef',
  'configurationVersion',
  'displayedPriceIncGst',
  'input',
  'schemaVersion',
  'status',
] as const;
const INPUT_KEYS = ['connection', 'level', 'projectionMm', 'widthMm'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function isSteppedDimension(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1_000 && Number(value) <= maximum
    && Number(value) % 100 === 0;
}

function parseSimpleCoverImportCandidateV1(
  value: unknown,
): SimpleCoverImportCandidateV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, HANDOFF_KEYS)) return null;
  if (
    value.schemaVersion !== 'simple-cover-handoff.v1'
    || (value.status !== 'priced' && value.status !== 'custom' && value.status !== 'unavailable')
    || !isRecord(value.input)
    || !hasExactKeys(value.input, INPUT_KEYS)
  ) {
    return null;
  }
  const input = value.input;
  if (
    !isSteppedDimension(input.widthMm, 10_000)
    || !isSteppedDimension(input.projectionMm, 6_000)
    || (input.level !== 'ground' && input.level !== 'elevated')
    || (input.connection !== 'fascia' && input.connection !== 'facade' && input.connection !== 'soffit')
  ) {
    return null;
  }

  const calculationRef = value.calculationRef;
  const displayedPrice = value.displayedPriceIncGst;
  const configurationVersion = value.configurationVersion;
  if (value.status === 'priced') {
    if (
      typeof calculationRef !== 'string'
      || calculationRef.length === 0
      || calculationRef.length > 2_048
      || typeof displayedPrice !== 'number'
      || !Number.isFinite(displayedPrice)
      || displayedPrice <= 0
      || !Number.isSafeInteger(configurationVersion)
      || Number(configurationVersion) < 1
    ) {
      return null;
    }
  } else if (calculationRef !== null || displayedPrice !== null || configurationVersion !== null) {
    return null;
  }

  return {
    schemaVersion: 'simple-cover-handoff.v1',
    input: {
      widthMm: input.widthMm,
      projectionMm: input.projectionMm,
      level: input.level,
      connection: input.connection,
    },
  };
}

function mapConnection(
  connection: SimpleCoverImportCandidateV1['input']['connection'],
): CustomerConnectionIntentV1 {
  if (connection === 'facade') return 'wall';
  return connection;
}

export function importSimpleCoverHandoffV1(
  raw: unknown,
  options: { configurationId: string; timestamp: string },
): CustomerPergolaConfigurationV1 | null {
  const handoff = parseSimpleCoverImportCandidateV1(raw);
  if (!handoff) return null;

  const initial = createDefaultCustomerPergolaConfigurationV1(options);
  const imported = normalizeCustomerPergolaConfigurationV1({
    ...initial,
    source: {
      kind: 'simple_cover_import',
      sourcePath: '/simple-cover-calculator',
      sourceSlug: null,
    },
    intent: {
      ...initial.intent,
      pergola: {
        ...initial.intent.pergola,
        family: 'mono',
        dimensions: {
          ...initial.intent.pergola.dimensions,
          lengthMm: handoff.input.widthMm,
          projectionMm: handoff.input.projectionMm,
        },
        placement: {
          mode: 'attached',
          attachmentSide: 'rear',
          connectionIntent: mapConnection(handoff.input.connection),
        },
        roof: { system: 'acrylic', tint: 'clear' },
      },
      site: {
        ...initial.intent.site,
        level: handoff.input.level,
      },
    },
  });
  return parseCustomerPergolaConfigurationV1(imported);
}
