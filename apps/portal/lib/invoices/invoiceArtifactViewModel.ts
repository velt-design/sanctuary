export type DepositInvoiceArtifactInput = {
  invoiceRef: string;
  quoteRef: string;
  quoteVersionNumber: number;
  customerName: string | null;
  projectName: string | null;
  projectAddress: string | null;
  issueDate: string;
  dueDate: string;
  depositPercent: number;
  quoteTotalIncGstCents: number;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
};

export type DepositInvoiceArtifactViewModel = {
  header: {
    title: string;
    invoiceRef: string;
    quoteRef: string;
    quoteVersionNumber: number;
  };
  customer: {
    name: string;
  };
  project: {
    name: string;
    addressLines: string[];
  };
  dates: {
    issue: string;
    due: string;
  };
  deposit: {
    percent: string;
    explanation: string;
  };
  totals: {
    quoteTotalIncGst: string;
    totalExGst: string;
    gst: string;
    totalIncGst: string;
  };
  payment: {
    reference: string;
    lines: string[];
    nextStep: string;
  };
  footer: {
    website: string;
    email: string;
  };
};

const MONEY = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(cents: number): string {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return MONEY.format(amount);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(parsed);
}

function formatPercent(value: number): string {
  const clamped = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
  return clamped
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function addressLines(value: string | null): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  const newlineParts = trimmed
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (newlineParts.length > 1) return newlineParts;

  const commaParts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (commaParts.length >= 3) {
    return [commaParts[0]!, commaParts.slice(1).join(", ")];
  }

  return [trimmed];
}

export function resolveDepositInvoicePaymentLines(
  storedInstructions: string | null,
  fallbackLines: readonly string[],
): string[] {
  const stored = String(storedInstructions ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return stored.length ? stored : [...fallbackLines];
}

export function buildDepositInvoiceArtifactViewModel(
  input: DepositInvoiceArtifactInput,
  paymentLines: readonly string[],
): DepositInvoiceArtifactViewModel {
  const depositPercent = formatPercent(input.depositPercent);
  const quoteIdentity = `${input.quoteRef} v${input.quoteVersionNumber}`;

  return {
    header: {
      title: "Deposit invoice",
      invoiceRef: input.invoiceRef,
      quoteRef: input.quoteRef,
      quoteVersionNumber: input.quoteVersionNumber,
    },
    customer: {
      name: input.customerName?.trim() || "Customer",
    },
    project: {
      name: input.projectName?.trim() || "Project",
      addressLines: addressLines(input.projectAddress),
    },
    dates: {
      issue: formatDate(input.issueDate),
      due: formatDate(input.dueDate),
    },
    deposit: {
      percent: depositPercent,
      explanation: `This invoice requests the ${depositPercent}% deposit for quote ${quoteIdentity}.`,
    },
    totals: {
      quoteTotalIncGst: formatMoney(input.quoteTotalIncGstCents),
      totalExGst: formatMoney(input.totalExGstCents),
      gst: formatMoney(input.gstCents),
      totalIncGst: formatMoney(input.totalIncGstCents),
    },
    payment: {
      reference: input.invoiceRef,
      lines: paymentLines.map((line) => line.trim()).filter(Boolean),
      nextStep:
        "Please use the payment reference above when making your transfer. If anything is unclear, contact us before making payment.",
    },
    footer: {
      website: "sanctuarypergolas.co.nz",
      email: "info@sanctuarypergolas.co.nz",
    },
  };
}
