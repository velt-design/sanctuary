import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Module from 'node:module';

import type { QuoteLineItem, QuoteTotals, QuoteVersionDetail } from '../apps/portal/lib/quotes/types';

const OUT_DIR = '/tmp/pdf-fixtures';
const EPS = 0.01;

const nowIso = new Date().toISOString();

const makeLineItem = (index: number, description: string, qty: number, totalCents: number): QuoteLineItem => {
  const unitPrice = qty > 0 ? Math.round(totalCents / qty) : totalCents;
  return {
    id: `item-${index + 1}`,
    description,
    qty,
    unitPriceIncGstCents: unitPrice,
    lineTotalIncGstCents: totalCents,
    sortOrder: index + 1,
  };
};

const baseTotals = (overrides?: Partial<QuoteTotals>): QuoteTotals => ({
  totalIncGstCents: 0,
  totalExGstCents: 0,
  gstCents: 0,
  ...overrides,
});

const makeQuote = (params: {
  quoteRef: string;
  versionNumber: number;
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
}): QuoteVersionDetail => ({
  id: `quote-version-${params.versionNumber}`,
  quoteId: 'quote-1',
  projectId: 'project-1',
  quoteRef: params.quoteRef,
  versionNumber: params.versionNumber,
  status: 'DRAFT',
  sourceEstimateVersionId: 'estimate-1',
  sourceEstimateVersionLabel: 'v1',
  createdAt: nowIso,
  createdBy: 'system',
  sentAt: nowIso,
  totals: params.totals,
  lineItems: params.lineItems,
  sendLogs: [],
  contact: {
    name: 'Test Client',
    email: 'client@example.com',
    phone: '0000000000',
  },
  project: {
    name: 'Test Project',
    siteAddress: '1 Test Street',
    region: 'Test Region',
    quoteRef: params.quoteRef,
  },
});

const shortQuote = makeQuote({
  quoteRef: 'Q-0002',
  versionNumber: 4,
  lineItems: [
    makeLineItem(
      0,
      'Signature Pergola\n- Color: Ironstone\n- Size: 4m x 3m\n- Connections: power=yes, drainage=no',
      1,
      125000,
    ),
  ],
  totals: baseTotals({ totalIncGstCents: 125000, totalExGstCents: 108695, gstCents: 16305 }),
});

const multiQuote = makeQuote({
  quoteRef: 'Q-0003',
  versionNumber: 2,
  lineItems: [
    makeLineItem(
      0,
      'Signature Pergola\n- Color: Monument\n- Size: 6m x 3m\n- Connections: power=yes, drainage=yes',
      1,
      210000,
    ),
    makeLineItem(
      1,
      'Electrical Package\n- Lights: 8 LED strips\n- Power: 2 circuits\n- Switch: Wall-mounted',
      1,
      45000,
    ),
    makeLineItem(
      2,
      'Ziptrak Blinds\n- Location: West\n- Fabric: Weather screen\n- Tracks: White',
      2,
      90000,
    ),
  ],
  totals: baseTotals({ totalIncGstCents: 345000, totalExGstCents: 300000, gstCents: 45000 }),
});

const overflowQuote = makeQuote({
  quoteRef: 'Q-0004',
  versionNumber: 1,
  lineItems: Array.from({ length: 10 }, (_, idx) =>
    makeLineItem(
      idx,
      [
        `Custom Module ${idx + 1}`,
        '- Color: Basalt',
        '- Size: 4m x 3m',
        '- Finish: Matte',
        '- Connections: power=yes, drainage=yes',
        '- Notes: Includes extended flashing kit',
      ].join('\n'),
      1,
      55000 + idx * 1500,
    ),
  ),
  totals: baseTotals({ totalIncGstCents: 700000, totalExGstCents: 608696, gstCents: 91304 }),
});

const largeTotalsQuote = makeQuote({
  quoteRef: 'Q-0005',
  versionNumber: 1,
  lineItems: [
    makeLineItem(
      0,
      'Commercial Pergola Package\n- Size: 20m x 8m\n- Finish: Anodized\n- Connections: power=yes, drainage=yes',
      1,
      25000000,
    ),
  ],
  totals: baseTotals({ totalIncGstCents: 25000000, totalExGstCents: 21739130, gstCents: 3260870 }),
});

const fixtures = [
  { name: 'short', quote: shortQuote },
  { name: 'multi', quote: multiQuote },
  { name: 'overflow', quote: overflowQuote },
  { name: 'large-totals', quote: largeTotalsQuote },
];

const approxEqual = (a: number, b: number) => Math.abs(a - b) <= EPS;

type LayoutRule = { kind: string; x0: number; x1: number; y: number };
type LayoutPage = {
  hasLeftRail: boolean;
  tableBounds?: { x0: number; x1: number; topY: number; bottomY: number } | null;
  totalsBounds?: { x0: number; x1: number; headerBaselineY: number; ceilingRuleY: number } | null;
  rules: LayoutRule[];
};
type QuotePdfLayout = { pages: LayoutPage[] };

const validateLayout = (name: string, layout: QuotePdfLayout) => {
  const errors: string[] = [];
  const page0 = layout.pages[0];
  if (!page0) {
    errors.push(`${name}: missing page 1 layout`);
    return errors;
  }

  if (page0.totalsBounds) {
    const totalsBounds = page0.totalsBounds;
    const totalsRules = page0.rules.filter((rule) => rule.kind.startsWith('totals'));
    const checkTotalsRule = (kind: string, bounds: { x0: number; x1: number }) => {
      const rule = totalsRules.find((item) => item.kind === kind);
      if (!rule) {
        errors.push(`${name}: missing totals rule ${kind}`);
        return;
      }
      if (!approxEqual(rule.x0, bounds.x0) || !approxEqual(rule.x1, bounds.x1)) {
        errors.push(`${name}: totals rule ${kind} does not match expected bounds`);
      }
    };

    if (page0.tableBounds) {
      checkTotalsRule('totalsCeiling', page0.tableBounds);
    } else {
      errors.push(`${name}: missing table bounds for totals ceiling check`);
    }
    checkTotalsRule('totalsAboveTotal', totalsBounds);
    checkTotalsRule('totalsBelowTotal', totalsBounds);

    if (!(totalsBounds.ceilingRuleY > totalsBounds.headerBaselineY)) {
      errors.push(`${name}: totals ceiling rule should sit above totals header baseline`);
    }

    if (page0.tableBounds) {
      if (page0.tableBounds.bottomY < totalsBounds.ceilingRuleY + 18 - EPS) {
        errors.push(`${name}: items table violates ceiling spacing (needs 18pt gap)`);
      }
    }
  } else {
    errors.push(`${name}: missing totals bounds`);
  }

  layout.pages.forEach((page, index) => {
    if (page.tableBounds) {
      const tableBounds = page.tableBounds;
      const tableRules = page.rules.filter((rule) => rule.kind.startsWith('items'));
      const headerRule = tableRules.find((rule) => rule.kind === 'itemsHeaderUnderline');
      if (!headerRule) {
        errors.push(`${name}: page ${index + 1} missing items header underline`);
      } else if (!approxEqual(headerRule.x0, tableBounds.x0) || !approxEqual(headerRule.x1, tableBounds.x1)) {
        errors.push(`${name}: page ${index + 1} items header underline does not match table bounds`);
      }

      const rowRules = tableRules.filter((rule) => rule.kind === 'itemsRowSeparator');
      rowRules.forEach((rule) => {
        if (!approxEqual(rule.x0, tableBounds.x0) || !approxEqual(rule.x1, tableBounds.x1)) {
          errors.push(`${name}: page ${index + 1} row separator does not match table bounds`);
        }
      });
    }

    if (index > 0) {
      if (!page.hasLeftRail) {
        errors.push(`${name}: page ${index + 1} missing left rail`);
      }
    }
  });

  return errors;
};

const run = async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const stubDir = path.join(__dirname, 'stubs');
  process.env.NODE_PATH = [stubDir, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  (Module as unknown as { _initPaths: () => void })._initPaths();

  const { generateQuotePdfBytesWithLayout } = await import('../apps/portal/lib/quotes/pdf');

  await mkdir(OUT_DIR, { recursive: true });
  let failures = 0;

  for (const fixture of fixtures) {
    const { bytes, layout } = await generateQuotePdfBytesWithLayout(fixture.quote);
    const filePath = path.join(OUT_DIR, `${fixture.name}.pdf`);
    await writeFile(filePath, bytes);

    const errors = validateLayout(fixture.name, layout as QuotePdfLayout);
    if (errors.length) {
      failures += 1;
      console.error(errors.join('\n'));
    } else {
      console.log(`${fixture.name}: ok`);
    }
  }

  if (failures) {
    process.exitCode = 1;
  }
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
