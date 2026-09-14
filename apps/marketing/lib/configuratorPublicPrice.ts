/** Customer-facing projection only. No supply costs, margins, payout or internal warnings. */
export type ConfiguratorPriceLine = { label: string; amountIncGst: number };
export type ConfiguratorPublicPrice =
  | { status: 'priced'; amountIncGst: number; currency: 'NZD'; includesGst: true;
      breakdown: ConfiguratorPriceLine[]; versionNumber: number; calculationRef: string }
  | { status: 'custom'; reason: string }
  | { status: 'unavailable' }
  | { status: 'disabled' };
