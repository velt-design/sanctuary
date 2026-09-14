/** Unpublished owner-review allowances. Never substitute these for a supplier quote. */
export const ACCESSORY_REVIEW_RATES = {
  // ThermoPine budget only: 75% of provisional cedar, guided by JSC ceiling ratios; not a batten quote.
  thermopineSupplyPerM: { '39x39': 9, '65x39': 13.5, '90x39': 18 },
  timberSupplyPerM: { '39x39': 12, '65x39': 18, '90x39': 24 },
  aluminiumSupplyPerM: { '50x10': 12, '65x16': 18 },
  selectedTimberLengthFactor: 1.3, wasteFactor: 1.1,
  timberCoatingPerM: 2, aluminiumFitPerM: 8,
  timberLabourPerHour: 65, timberCutMinutes: 2, timberFixMinutes: 1.5, timberSetupHours: 1, timberFixingsPerPoint: .35,
  frameSupplyAndFitPerM: 45, plateSupplyAndFitPerM: 25,
  upgradedFrameExtraPerM: 20, panelSetup: 120,
  cedarLightSupplyAndFitEach: 140,
  ledSupplyChannelAndFitPerM: 65, ledDriverPerRun: 100,
  electricalConnection: 550,
} as const;

type NumericRates<T> = { -readonly [K in keyof T]: T[K] extends number ? number : NumericRates<T[K]> };
export type AccessoryRates = NumericRates<typeof ACCESSORY_REVIEW_RATES>;

/** Absent on historical versions; never silently fill an incomplete saved catalogue. */
export function validateAccessoryRates(value: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  const visit = (candidate: unknown, expected: unknown, path: string) => {
    if (typeof expected === 'number') {
      const factor = path.endsWith('Factor');
      if (typeof candidate !== 'number' || !Number.isFinite(candidate) || candidate < (factor ? 1 : 0) || candidate > (factor ? 5 : 100_000)) {
        issues.push({ path, message: factor ? 'Must be a factor between 1 and 5.' : 'Must be a finite amount between 0 and 100,000.' });
      }
      return;
    }
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      issues.push({ path, message: 'Must contain every supported accessory rate.' }); return;
    }
    const schema = expected as Record<string, unknown>, values = candidate as Record<string, unknown>;
    for (const key of Object.keys(values)) if (!Object.prototype.hasOwnProperty.call(schema, key)) issues.push({ path: `${path}.${key}`, message: 'Unsupported accessory rate.' });
    for (const [key, child] of Object.entries(schema)) visit(values[key], child, `${path}.${key}`);
  };
  visit(value, ACCESSORY_REVIEW_RATES, 'accessoryRates');
  return issues;
}
