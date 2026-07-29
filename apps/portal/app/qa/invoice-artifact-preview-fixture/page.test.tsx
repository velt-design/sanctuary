import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InvoiceArtifactPreviewFixturePage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("./InvoiceArtifactPreviewFixtureClient", () => ({
  default: ({ preview }: any) => (
    <div
      data-testid="invoice-preview-fixture"
      data-invoice-ref={preview.invoiceRef}
      data-source={preview.source}
      data-recipient={preview.recipients.to.join(",")}
      data-html={preview.html}
      data-text={preview.text}
    />
  ),
}));

describe("InvoiceArtifactPreviewFixturePage", () => {
  const originalFlag = process.env.ENABLE_PORTAL_QA_FIXTURES;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    } else {
      process.env.ENABLE_PORTAL_QA_FIXTURES = originalFlag;
    }
  });

  it("is unavailable unless data-free QA fixtures are enabled", async () => {
    delete process.env.ENABLE_PORTAL_QA_FIXTURES;
    await expect(InvoiceArtifactPreviewFixturePage()).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("renders production email output with synthetic identities only", async () => {
    process.env.ENABLE_PORTAL_QA_FIXTURES = "1";
    const page = await InvoiceArtifactPreviewFixturePage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain('data-testid="invoice-preview-fixture"');
    expect(html).toContain('data-invoice-ref="INV-2026-0147"');
    expect(html).toContain('data-source="prospective"');
    expect(html).toContain('data-recipient="customer@example.invalid"');
    expect(html).toContain("accounts@example.invalid");
    expect(html).toContain("https://preview.invalid/invoice/fixture");
    expect(html).not.toContain("service_role");
  });
});
