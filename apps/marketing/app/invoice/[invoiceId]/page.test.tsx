import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import type { PublicDepositInvoice } from "@/lib/invoices/publicInvoice";
import Loading from "./loading";
import InvoicePage from "./page";

const loadPublicDepositInvoiceByToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/invoices/publicInvoice", () => ({
  loadPublicDepositInvoiceByToken,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const fixtureInvoice: PublicDepositInvoice = {
  id: "invoice_fixture",
  status: "OPEN",
  invoiceRef: "INV-2026-0147",
  quoteRef: "Q-2026-0092",
  quoteVersionId: "quote_version_fixture",
  quoteVersionNumber: 3,
  issueDate: "2026-07-21",
  dueDate: "2026-07-28",
  reference: "Deposit for accepted courtyard pergola quote",
  customerName: "Taylor Morgan",
  projectName: "Warkworth Courtyard",
  projectAddress: "1 Fixture Road, Warkworth",
  paymentInstructions: [
    "Pay by bank transfer.",
    "Account name: Sanctuary fixture account",
    "Account number: 00-0000-0000000-00",
    "Include the invoice number as your reference.",
  ].join("\n"),
  depositPercent: 50,
  quoteTotalIncGstCents: 2300000,
  totalIncGstCents: 1150000,
  totalExGstCents: 1000000,
  gstCents: 150000,
  tokenExpiresAt: "2026-08-27T23:59:59.999Z",
  pdfFileId: "invoice_pdf_fixture",
  quotePdfFileId: "quote_pdf_fixture",
};

async function writeVisualFixture(view: ReactNode, suffix = ""): Promise<void> {
  const configuredPath = process.env.INVOICE_PUBLIC_FIXTURE_PATH?.trim();
  if (!configuredPath) return;

  const parsed = path.parse(configuredPath);
  const outputPath = suffix
    ? path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".html"}`)
    : configuredPath;
  const css = await readFile(
    path.resolve(
      process.cwd(),
      "apps/marketing/app/invoice/[invoiceId]/invoiceEditorial.module.css",
    ),
    "utf8",
  );
  const fixtureCss = css.replace(
    /\.([a-zA-Z][a-zA-Z0-9_-]*)/g,
    '[class*="_$1_"]',
  );
  await writeFile(
    outputPath,
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fixtureCss}</style></head><body style="margin:0">${renderToStaticMarkup(view)}</body></html>`,
    "utf8",
  );
}

async function renderOpenInvoice(
  overrides: Partial<PublicDepositInvoice> = {},
) {
  loadPublicDepositInvoiceByToken.mockResolvedValue({
    invoice: { ...fixtureInvoice, ...overrides },
  });

  return InvoicePage({
    params: Promise.resolve({ invoiceId: "invoice_fixture" }),
    searchParams: Promise.resolve({ token: "fixture token" }),
  });
}

describe("public invoice presentation", () => {
  beforeEach(() => {
    loadPublicDepositInvoiceByToken.mockReset();
  });

  it("presents the token-scoped invoice as a payment ledger without changing download URLs", async () => {
    const view = await renderOpenInvoice();
    await writeVisualFixture(view);

    const rendered = renderIntoDocument(view);

    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      "Deposit invoice",
    );
    expect(rendered.container.querySelectorAll("h1")).toHaveLength(1);
    expect(
      rendered.container.querySelector('section[aria-label="Payment summary"]')
        ?.textContent,
    ).toContain("$11,500.00");
    expect(
      rendered.container.querySelector('section[aria-label="Payment summary"]')
        ?.textContent,
    ).toContain("28 Jul 2026");
    expect(
      rendered.container.querySelector('section[aria-label="Payment summary"]')
        ?.textContent,
    ).toContain("INV-2026-0147");
    expect(
      rendered.container.querySelector(
        'section[aria-label="About this invoice"]',
      )?.textContent,
    ).toContain("50% deposit on quote Q-2026-0092 v3");
    expect(
      rendered.container.querySelector(
        'section[aria-labelledby="invoice-details-heading"]',
      )?.textContent,
    ).toContain("28 Aug 2026");
    expect(
      rendered.container.querySelector('[data-label="Deposit rate"]')
        ?.textContent,
    ).toBe("50%");
    expect(
      rendered.container.querySelector('[data-label="Amount inc GST"]')
        ?.textContent,
    ).toBe("$11,500.00");

    const invoicePdf = rendered.container.querySelector<HTMLAnchorElement>(
      'a[href="/api/invoices/invoice_fixture/pdf?token=fixture%20token"]',
    );
    const sourceQuotePdf = rendered.container.querySelector<HTMLAnchorElement>(
      'a[href="/api/invoices/invoice_fixture/quote-pdf?token=fixture%20token"]',
    );
    expect(invoicePdf?.textContent).toBe("Invoice PDF");
    expect(sourceQuotePdf?.textContent).toBe("Source quote PDF");
    expect(
      rendered.container.querySelector(
        'section[aria-labelledby="payment-heading"]',
      )?.textContent,
    ).toContain("Include the invoice number as your reference.");
    expect(
      rendered.container.querySelector(
        'section[aria-labelledby="help-heading"] a[href="/contact"]',
      ),
    ).not.toBeNull();

    rendered.unmount();
  });

  it("renders clear disabled document controls when stored artifacts are unavailable", async () => {
    const view = await renderOpenInvoice({
      pdfFileId: null,
      quotePdfFileId: null,
      paymentInstructions: null,
    });
    await writeVisualFixture(view, "unavailable-documents");
    const rendered = renderIntoDocument(view);
    const disabledActions = Array.from(
      rendered.container.querySelectorAll<HTMLButtonElement>("button:disabled"),
    ).map((button) => button.textContent);

    expect(disabledActions).toEqual([
      "Invoice PDF unavailable",
      "Source quote PDF unavailable",
    ]);
    expect(
      rendered.container.querySelector('a[href*="/api/invoices/"]'),
    ).toBeNull();
    expect(
      rendered.container.querySelector(
        'section[aria-labelledby="payment-heading"]',
      )?.textContent,
    ).toContain("Payment instructions are unavailable");

    rendered.unmount();
  });

  it("does not perform a lookup when the token is missing", async () => {
    const view = await InvoicePage({
      params: Promise.resolve({ invoiceId: "invoice_fixture" }),
      searchParams: Promise.resolve({}),
    });
    await writeVisualFixture(view, "missing-token");
    const rendered = renderIntoDocument(view);

    expect(loadPublicDepositInvoiceByToken).not.toHaveBeenCalled();
    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      "Missing invoice token",
    );
    expect(
      rendered.container.querySelector('a[href="/contact"]'),
    ).not.toBeNull();

    rendered.unmount();
  });

  it("announces the secure-link loading state", async () => {
    const view = <Loading />;
    await writeVisualFixture(view, "loading");
    const rendered = renderIntoDocument(view);

    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      "Loading invoice",
    );
    expect(
      rendered.container.querySelector('[role="status"]')?.textContent,
    ).toContain("Checking this secure invoice link");

    rendered.unmount();
  });

  it.each([
    ["invalid", "invalid or unavailable"],
    ["expired", "has expired"],
    ["void", "no longer active"],
  ] as const)(
    "keeps the %s token state fail-closed",
    async (reason, expectedCopy) => {
      loadPublicDepositInvoiceByToken.mockResolvedValue({
        invoice: null,
        reason,
      });

      const view = await InvoicePage({
        params: Promise.resolve({ invoiceId: "invoice_fixture" }),
        searchParams: Promise.resolve({ token: "fixture token" }),
      });
      await writeVisualFixture(view, reason);
      const rendered = renderIntoDocument(view);

      expect(rendered.container.querySelector("h1")?.textContent).toBe(
        "Invoice unavailable",
      );
      expect(rendered.container.textContent).toContain(expectedCopy);
      expect(rendered.container.textContent).not.toContain(
        fixtureInvoice.customerName,
      );
      expect(
        rendered.container.querySelector('a[href="/contact"]'),
      ).not.toBeNull();

      rendered.unmount();
    },
  );
});
