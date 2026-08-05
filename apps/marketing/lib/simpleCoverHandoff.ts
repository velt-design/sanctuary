import {
  parseSimpleCoverInput,
  type SimpleCoverInput,
} from './simpleCoverCalculator';

export const SIMPLE_COVER_HANDOFF_STORAGE_KEY = 'sanctuary.simple-cover-handoff.v1';

export type SimpleCoverHandoff = {
  schemaVersion: 'simple-cover-handoff.v1';
  status: 'priced' | 'custom' | 'unavailable';
  input: SimpleCoverInput;
  calculationRef: string | null;
  displayedPriceIncGst: number | null;
  configurationVersion: number | null;
};

function parseOptionalPositiveNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function parseOptionalPositiveInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

export function parseSimpleCoverHandoff(value: unknown): SimpleCoverHandoff | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== 'simple-cover-handoff.v1'
    || (candidate.status !== 'priced' && candidate.status !== 'custom' && candidate.status !== 'unavailable')
  ) {
    return null;
  }

  const input = parseSimpleCoverInput(candidate.input);
  const displayedPriceIncGst = parseOptionalPositiveNumber(candidate.displayedPriceIncGst);
  const configurationVersion = parseOptionalPositiveInteger(candidate.configurationVersion);
  const calculationRef = candidate.calculationRef === null
    ? null
    : typeof candidate.calculationRef === 'string' && candidate.calculationRef.length <= 2_048
      ? candidate.calculationRef
      : undefined;
  if (!input || displayedPriceIncGst === undefined || configurationVersion === undefined || calculationRef === undefined) {
    return null;
  }
  if (
    candidate.status === 'priced'
    && (!calculationRef || displayedPriceIncGst === null || configurationVersion === null)
  ) {
    return null;
  }
  if (
    candidate.status !== 'priced'
    && (calculationRef !== null || displayedPriceIncGst !== null || configurationVersion !== null)
  ) {
    return null;
  }

  return {
    schemaVersion: 'simple-cover-handoff.v1',
    status: candidate.status,
    input,
    calculationRef,
    displayedPriceIncGst,
    configurationVersion,
  };
}

export function storeSimpleCoverHandoff(handoff: SimpleCoverHandoff): void {
  try {
    window.sessionStorage.setItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
  } catch {
    // The same-page handoff still works when browser storage is unavailable.
  }
}

export function readStoredSimpleCoverHandoff(): SimpleCoverHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(SIMPLE_COVER_HANDOFF_STORAGE_KEY);
    return raw ? parseSimpleCoverHandoff(JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}
