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

vi.mock('./QuotePdfInlinePreview', () => ({
  default: ({ data }: { data: Uint8Array }) => <canvas aria-label="Rendered PDF" data-byte-length={data.byteLength} />,
}));

describe("InvoiceArtifactPreviewDialog", () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70]), {
      headers: { 'content-type': 'application/pdf', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" },
    })));
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
    vi.unstubAllGlobals();
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

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(fetch).toHaveBeenCalledWith('/api/staff/v1/invoices/inv_1/preview/pdf', expect.objectContaining({
      credentials: 'same-origin', cache: 'no-store', signal: expect.any(AbortSignal),
    }));
    expect(document.querySelector('canvas[aria-label="Rendered PDF"]')?.getAttribute('data-byte-length')).toBe('4');
    expect(document.querySelector('iframe[title*="PDF preview"]')).toBeNull();

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

  it('offers a retry when the protected PDF request fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    const rendered = renderIntoDocument(<InvoiceArtifactPreviewDialog invoiceId="inv_1" invoiceRef="INV-1" onClose={vi.fn()} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(document.body.textContent).toContain('Could not load invoice PDF (503).');
    const retry = Array.from(document.querySelectorAll('button')).find((button) => /retry/i.test(button.textContent ?? ''));
    await act(async () => { retry!.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(document.querySelector('canvas[aria-label="Rendered PDF"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain('(503)');
    rendered.unmount();
  });
});
