import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { formatModuleRoof, formatModuleSize, formatModuleStyle } from '@/lib/quotes/moduleFormatters';
import type { ResolvedCurrentDesign } from './resolve';

const MONEY_FORMAT = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export type CurrentDesignStatusVariant = 'accepted' | 'sent' | 'draft' | 'declined' | 'muted';

type CurrentDesignSummary = {
  size: string;
  shape: string;
  totalLabel: string;
  statusLabel: string;
  statusVariant: CurrentDesignStatusVariant;
  quoteVersionId: string | null;
  estimateId: string | null;
  additionalModuleCount: number;
  isEmpty: boolean;
};

const SIZE_FALLBACK = 'Size not set';
const SHAPE_FALLBACK = 'Design details incomplete';
const PRICE_FALLBACK = 'Price not available';

const STATUS_LABEL: Record<ResolvedCurrentDesign['status'], string> = {
  quote_accepted: 'Quote accepted',
  quote_sent: 'Sent',
  quote_draft: 'Draft',
  quotes_declined: 'Quotes declined',
  no_accepted_quote: 'No accepted quote',
  empty: 'No design',
};

const STATUS_VARIANT: Record<ResolvedCurrentDesign['status'], CurrentDesignStatusVariant> = {
  quote_accepted: 'accepted',
  quote_sent: 'sent',
  quote_draft: 'draft',
  quotes_declined: 'declined',
  no_accepted_quote: 'muted',
  empty: 'muted',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readModulesFromCalculatorSnapshot(snapshot: unknown): CalculatorModuleInputs[] {
  if (!isRecord(snapshot)) return [];
  const inputs = snapshot.inputs;
  if (!isRecord(inputs)) return [];
  const modules = (inputs as { modules?: unknown }).modules;
  return Array.isArray(modules) ? (modules as CalculatorModuleInputs[]) : [];
}

function moduleArea(module: CalculatorModuleInputs): number {
  const length = Number.parseFloat(String(module?.lengthM ?? ''));
  const projection = Number.parseFloat(String(module?.projectionM ?? ''));
  if (!Number.isFinite(length) || !Number.isFinite(projection)) return 0;
  return length * projection;
}

function pickPrimaryModule(modules: CalculatorModuleInputs[]): CalculatorModuleInputs | null {
  if (modules.length === 0) return null;
  let primary = modules[0]!;
  let primaryArea = moduleArea(primary);
  for (const candidate of modules.slice(1)) {
    const area = moduleArea(candidate);
    if (area > primaryArea) {
      primary = candidate;
      primaryArea = area;
    }
  }
  return primary;
}

function formatShape(module: CalculatorModuleInputs | null): string {
  if (!module) return SHAPE_FALLBACK;
  const style = formatModuleStyle(module);
  const roof = formatModuleRoof(module);
  if (style && roof) return `${style} ${roof.toLowerCase()}`;
  if (style) return style;
  if (roof) return roof;
  return SHAPE_FALLBACK;
}

function formatSize(module: CalculatorModuleInputs | null, additionalCount: number): string {
  if (!module) return SIZE_FALLBACK;
  const base = formatModuleSize(module);
  if (additionalCount > 0) return `${base} + ${additionalCount} more`;
  return base;
}

function formatTotalLabel(resolved: ResolvedCurrentDesign): string {
  const fromQuote = resolved.quoteVersion?.totals?.totalIncGstCents;
  if (typeof fromQuote === 'number' && Number.isFinite(fromQuote)) {
    return `${MONEY_FORMAT.format(fromQuote / 100)} inc GST`;
  }
  const fromEstimate = resolved.estimate?.summary?.total;
  if (typeof fromEstimate === 'number' && Number.isFinite(fromEstimate)) {
    return `${MONEY_FORMAT.format(fromEstimate)} inc GST`;
  }
  return PRICE_FALLBACK;
}

export function summarizeCurrentDesign(
  resolved: ResolvedCurrentDesign,
  calculatorSnapshot: unknown = null,
): CurrentDesignSummary {
  if (resolved.source === 'empty') {
    return {
      size: SIZE_FALLBACK,
      shape: SHAPE_FALLBACK,
      totalLabel: PRICE_FALLBACK,
      statusLabel: STATUS_LABEL.empty,
      statusVariant: STATUS_VARIANT.empty,
      quoteVersionId: null,
      estimateId: null,
      additionalModuleCount: 0,
      isEmpty: true,
    };
  }

  const modules = readModulesFromCalculatorSnapshot(calculatorSnapshot);
  const primary = pickPrimaryModule(modules);
  const additionalModuleCount = modules.length > 1 ? modules.length - 1 : 0;

  return {
    size: formatSize(primary, additionalModuleCount),
    shape: formatShape(primary),
    totalLabel: formatTotalLabel(resolved),
    statusLabel: STATUS_LABEL[resolved.status],
    statusVariant: STATUS_VARIANT[resolved.status],
    quoteVersionId: resolved.quoteVersion?.id ?? null,
    estimateId: resolved.estimate?.id ?? null,
    additionalModuleCount,
    isEmpty: false,
  };
}
