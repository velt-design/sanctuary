import { describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../test/reactHarness";
import QuotePage from "./page";

const loadPublicQuoteByToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/quotes/publicQuote", () => ({
  loadPublicQuoteByToken,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("public quote presentation", () => {
  it("keeps the token-scoped acceptance contract inside the editorial hierarchy", async () => {
    loadPublicQuoteByToken.mockResolvedValue({
      quote: {
        id: "qv_1",
        status: "SENT",
        quoteRef: "Q-1001",
        versionNumber: 2,
        customerName: "Taylor",
        projectName: "Warkworth Courtyard",
        projectAddress: "1 Example Road, Warkworth",
        totalIncGstCents: 115000,
        totalExGstCents: 100000,
        gstCents: 15000,
        createdAt: "2026-07-01T00:00:00.000Z",
        sentAt: "2026-07-01T00:00:00.000Z",
        expiresAt: "2026-07-31",
        tokenExpiresAt: "2026-07-31T23:59:59.999Z",
        introText: "Thank you for the opportunity to quote.",
        termsText: "A 50% deposit is required after acceptance.",
        lineItems: [
          {
            id: "line_1",
            description: "Pergola 1\n- Roof: Acrylic",
            qty: 1,
            lineTotalIncGstCents: 115000,
          },
        ],
        attachments: [
          {
            id: "file_1",
            label: "Planning set.pdf",
            href: "/api/quotes/qv_1/attachments/file_1?token=secret",
          },
        ],
      },
    });

    const view = await QuotePage({
      params: Promise.resolve({ quoteId: "qv_1" }),
      searchParams: Promise.resolve({ token: "secret" }),
    });

    const visualFixturePath = process.env.QUOTE_PUBLIC_FIXTURE_PATH?.trim();
    if (visualFixturePath) {
      const css = await readFile(
        path.resolve(
          process.cwd(),
          "apps/marketing/app/quote/[quoteId]/quoteEditorial.module.css",
        ),
        "utf8",
      );
      const fixtureCss = css.replace(
        /\.([a-zA-Z][a-zA-Z0-9_-]*)/g,
        '[class*="_$1_"]',
      );
      await writeFile(
        visualFixturePath,
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fixtureCss}</style></head><body style="margin:0">${renderToStaticMarkup(view)}</body></html>`,
        "utf8",
      );
    }

    const rendered = renderIntoDocument(view);

    expect(rendered.container.querySelector("h1")?.textContent).toBe(
      "Warkworth Courtyard",
    );
    expect(
      rendered.container.querySelector('section[aria-label="Quote totals"]')
        ?.textContent,
    ).toContain("$1,150.00");
    expect(
      rendered.container.querySelector("main > section")?.textContent,
    ).not.toContain("$1,150.00");
    expect(
      rendered.container.querySelector('[data-label="Amount"]'),
    ).not.toBeNull();

    const form = rendered.container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/api/quotes/qv_1/accept");
    expect(
      rendered.container.querySelector<HTMLInputElement>(
        'input[name="token"]',
      )?.value,
    ).toBe("secret");

    const attachment = rendered.container.querySelector(
      'a[href*="/attachments/"]',
    );
    const acceptButton = rendered.container.querySelector(
      'button[type="submit"]',
    );
    expect(
      Boolean(
        attachment &&
          acceptButton &&
          attachment.compareDocumentPosition(acceptButton) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    rendered.unmount();
  });
});
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
