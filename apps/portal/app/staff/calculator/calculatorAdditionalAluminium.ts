import type {
  CalculatorAdditionalAluminiumRow,
  CalculatorAdditionalAluminiumState,
} from '@/lib/types/calculator';

export function makeAdditionalAluminiumId(): string {
  return `additional-aluminium-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeAdditionalAluminiumRow(seed?: Partial<CalculatorAdditionalAluminiumRow>): CalculatorAdditionalAluminiumRow {
  return {
    id: seed?.id?.trim() || makeAdditionalAluminiumId(),
    profile: String(seed?.profile ?? ''),
    stockLengthM: String(seed?.stockLengthM ?? ''),
    quantity: String(seed?.quantity ?? '1'),
  };
}

export function normalizeAdditionalAluminiumState(value: unknown): CalculatorAdditionalAluminiumState {
  if (!value || typeof value !== 'object' || !Array.isArray((value as CalculatorAdditionalAluminiumState).rows)) {
    return { rows: [], extrusionColour: 'Black', powdercoatIsCustom: false };
  }

  const source = value as CalculatorAdditionalAluminiumState;
  return {
    rows: source.rows
      .filter((row): row is CalculatorAdditionalAluminiumRow => Boolean(row && typeof row === 'object'))
      .map((row, index) => makeAdditionalAluminiumRow({
        ...row,
        id: row.id?.trim() || `additional-aluminium-${index + 1}`,
      })),
    extrusionColour:
      source.extrusionColour === 'White' || source.extrusionColour === 'Mill'
        ? source.extrusionColour
        : 'Black',
    powdercoatStandardColour:
      typeof source.powdercoatStandardColour === 'string' ? source.powdercoatStandardColour : undefined,
    powdercoatIsCustom: source.powdercoatIsCustom === true,
    powdercoatCustomColour:
      typeof source.powdercoatCustomColour === 'string' ? source.powdercoatCustomColour : undefined,
  };
}
