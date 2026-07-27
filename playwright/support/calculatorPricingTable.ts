import type { Locator } from '@playwright/test';

type CalculatorPricingRow = {
  label: string;
  type: string;
  amount: string;
  priceIncGstCents: number | null;
};

export async function readCalculatorPricingRows(
  itemPricing: Locator,
): Promise<CalculatorPricingRow[]> {
  const rows = await itemPricing.locator('tbody tr').evaluateAll((elements) =>
    elements.map((element) => {
      const cells = element.querySelectorAll('th, td');
      return {
        label: cells[0]?.textContent?.trim() ?? '',
        type: cells[1]?.textContent?.trim() ?? '',
        amount: cells[2]?.textContent?.trim() ?? '',
      };
    }),
  );

  return rows.map((row) => ({
    ...row,
    priceIncGstCents: row.amount.startsWith('$')
      ? Math.round(Number.parseFloat(row.amount.replace(/[^0-9.-]/g, '')) * 100)
      : null,
  }));
}

export function sumCalculatorPricingRows(
  rows: readonly CalculatorPricingRow[],
  includedTypes?: readonly string[],
): number {
  return rows.reduce(
    (sum, row) =>
      includedTypes && !includedTypes.includes(row.type)
        ? sum
        : sum + (row.priceIncGstCents ?? 0),
    0,
  );
}
