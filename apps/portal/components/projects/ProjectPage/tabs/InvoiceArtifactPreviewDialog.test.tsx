import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import InvoiceArtifactPreviewDialog from "./InvoiceArtifactPreviewDialog";

const { loadDepositInvoiceArtifactPreview } = vi.hoisted(() => ({
  loadDepositInvoiceArtifactPreview: vi.fn(),
}));

vi.mock("@/lib/repo/invoicesRepo", () => ({
  loadDepositInvoiceArtifactPreview,
  depositInvoicePdfPreviewUrl: (invoiceId: string) =>
    `/api/staff/v1/invoices/${invoiceId}/preview/pdf`,
}));

describe("InvoiceArtifactPreviewDialog", () => {
  beforeEach(() => {
    loadDepositInvoiceArtifactPreview.mockReset();
    loadDepositInvoiceArtifactPreview.mockResolvedValue({
      invoiceId: "inv_1",
      invoiceRef: "INV-2026-0147",
      subject: "Deposit invoice - INV-2026-0147",
      html: "<!doctype html><html><body>Rendered invoice email</body></html>",
      text: "View invoice\nhttps://example.invalid?token=[redacted]",
      recipients: {
        to: ["customer@example.invalid"],
        cc: ["project@example.invalid"],
        bcc: ["audit@example.invalid"],
      },
      attachmentNames: ["INV-2026-0147.pdf"],
      source: "prepared",
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the PDF and both responsive delivery-renderer previews", async () => {
    const onClose = vi.fn();
    const rendered = renderIntoDocument(
      <InvoiceArtifactPreviewDialog
        invoiceId="inv_1"
        invoiceRef="INV-2026-0147"
        onClose={onClose}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadDepositInvoiceArtifactPreview).toHaveBeenCalledWith("inv_1");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Deposit invoice - INV-2026-0147",
    );
    expect(document.body.textContent).toContain("customer@example.invalid");
    expect(document.body.textContent).toContain("project@example.invalid");
    expect(document.body.textContent).toContain("audit@example.invalid");
    expect(document.body.textContent).toMatch(/To.*customer@example\.invalid/);
    expect(document.body.textContent).toMatch(/CC.*project@example\.invalid/);
    expect(document.body.textContent).toMatch(/BCC.*audit@example\.invalid/);

    const pdfFrame = document.querySelector<HTMLIFrameElement>(
      'iframe[title*="PDF preview"]',
    );
    expect(pdfFrame?.getAttribute("src")).toBe(
      "/api/staff/v1/invoices/inv_1/preview/pdf",
    );

    const narrowTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="group"][aria-label="Invoice artifact preview"] button',
      ),
    ).find((button) => button.textContent === "Email narrow");
    act(() => narrowTab?.click());
    expect(
      document.querySelector<HTMLIFrameElement>('iframe[title*="narrow"]')
        ?.srcdoc,
    ).toContain("Rendered invoice email");

    const textTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="group"][aria-label="Invoice artifact preview"] button',
      ),
    ).find((button) => button.textContent === "Plain text");
    act(() => textTab?.click());
    expect(document.querySelector("pre")?.textContent).toContain(
      "?token=[redacted]",
    );

    rendered.unmount();
  });
});
