import {
  formatQuoteIntroText,
  formatQuoteLineDescription,
  formatQuoteTermsText,
  type QuoteLineDescriptionEntry,
} from '@sp/quote-format';
import { normalizeDepositPercent } from './defaults';
import type { QuoteVersionDetail } from './types';
import { fromCents } from './utils';

const WAREHOUSE_ADDRESS = '71G Montgomerie Road, Mangere, 2022, Auckland';

const MONEY_FORMAT = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type PdfQuoteViewModel = {
  header: {
    quoteNumber: string;
    versionNumber: number;
    projectName: string;
  };
  client: {
    name?: string;
    addressLines: string[];
  };
  sanctuaryAddressLines: string[];
  issueDate?: string;
  expiryDate?: string;
  intro?: string;
  items: Array<{
    heading: string;
    entries: QuoteLineDescriptionEntry[];
    qtyText: string;
    unitPrice: string;
    amount: string;
  }>;
  totals: {
    inc: string;
    ex: string;
    gst: string;
  };
  deposit: {
    percent: string;
    nextStep: string;
  };
  terms: string[];
  footer: {
    website: string;
    email: string;
  };
};

function formatMoneyFromCents(cents: number): string {
  const dollars = Number.isFinite(cents) ? fromCents(cents) : 0;
  return MONEY_FORMAT.format(dollars);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  });
}

function addDays(value: string, days: number): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function addressLines(value: string | null | undefined): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  const byNewline = trimmed
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  const byComma = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (byComma.length >= 3) {
    return [byComma[0], byComma.slice(1).join(', ')];
  }

  return [trimmed];
}

function formatDepositPercent(value: number): string {
  return normalizeDepositPercent(value)
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

export function buildPdfQuoteViewModel(quote: QuoteVersionDetail): PdfQuoteViewModel {
  const sentOrCreatedAt = quote.sentAt ?? quote.createdAt;
  const issueDate = formatDate(sentOrCreatedAt);
  const expiryDate =
    formatDate(quote.expiresAt) ??
    (sentOrCreatedAt ? formatDate(addDays(sentOrCreatedAt, 30)) : null);
  const depositPercent = formatDepositPercent(quote.depositPercent);

  return {
    header: {
      quoteNumber: quote.quoteRef,
      versionNumber: quote.versionNumber,
      projectName: formatQuoteIntroText(quote.project.name) || 'Project',
    },
    client: {
      name: formatQuoteIntroText(quote.customerName ?? quote.contact.name) ?? undefined,
      addressLines: addressLines(quote.project.siteAddress),
    },
    sanctuaryAddressLines: addressLines(WAREHOUSE_ADDRESS),
    issueDate: issueDate ?? undefined,
    expiryDate: expiryDate ?? undefined,
    intro: formatQuoteIntroText(quote.introText) ?? undefined,
    items: quote.lineItems.map((item, index) => {
      const { heading, entries } = formatQuoteLineDescription(item.description, index);
      const qty = Number.isFinite(item.qty) ? item.qty : 0;
      const amountCents = Number.isFinite(item.lineTotalIncGstCents)
        ? item.lineTotalIncGstCents
        : 0;
      const unitPriceCents =
        Number.isFinite(item.unitPriceIncGstCents)
          ? item.unitPriceIncGstCents
          : Math.abs(qty) > 0.000_001
            ? Math.round(amountCents / qty)
            : 0;

      return {
        heading,
        entries,
        qtyText: new Intl.NumberFormat('en-NZ', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(qty),
        unitPrice: formatMoneyFromCents(unitPriceCents),
        amount: formatMoneyFromCents(amountCents),
      };
    }),
    totals: {
      inc: formatMoneyFromCents(quote.totals.totalIncGstCents),
      ex: formatMoneyFromCents(quote.totals.totalExGstCents),
      gst: formatMoneyFromCents(quote.totals.gstCents),
    },
    deposit: {
      percent: depositPercent,
      nextStep: `If you accept this quote, we will issue a ${depositPercent}% deposit invoice with payment details. No payment is due with this quote.`,
    },
    terms: formatQuoteTermsText(quote.termsText, { sentAt: quote.sentAt }),
    footer: {
      website: 'sanctuarypergolas.co.nz',
      email: 'info@sanctuarypergolas.co.nz',
    },
  };
}
