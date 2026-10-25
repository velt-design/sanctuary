import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderIntoDocument } from "../../../../../../test/reactHarness";
import { ApiError } from "@/lib/repo/apiClient";
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
  default: ({ data, readError, onRetry }: { data: Uint8Array | null; readError?: string; onRetry?: () => void }) => <div data-pdf-owner>{readError}<button onClick={onRetry}>Retry PDF</button>{data ? <canvas aria-label="Rendered PDF" data-byte-length={data.byteLength} /> : null}</div>,
}));

describe("InvoiceArtifactPreviewDialog", () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new Uint8Array([37, 80, 68, 70]), {
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
  it("mounts real modes, unknown delivery fields and viewport before metadata, then retries in place", async () => {
    const seed = await loadDepositInvoiceArtifactPreview.getMockImplementation()!();
    let resolveRead!: (value: typeof seed) => void;
    loadDepositInvoiceArtifactPreview.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    const view = renderIntoDocument(<InvoiceArtifactPreviewDialog invoiceId="inv_1" invoiceRef="INV-1" onClose={vi.fn()} />);
    const modes = document.body.querySelector('[aria-label="Invoice artifact preview"]')!;
    expect(modes.textContent).toContain("Plain text");
    expect(document.body.textContent).toContain("Attachments");
    expect(document.body.textContent).toContain("Reading…");
    const email = Array.from(modes.querySelectorAll("button")).find((button) => button.textContent === "Email desktop")!;
    act(() => email.click());
    const frame = document.body.querySelector("iframe")!;
    expect(frame.getAttribute("srcdoc")).toBeNull();
    await act(async () => resolveRead(seed));
    expect(document.body.querySelector("iframe")).toBe(frame);
    expect(document.body.querySelector('[aria-label="Invoice artifact preview"]')).toBe(modes);
    expect(frame.srcdoc).toContain("Rendered invoice email");
    view.unmount();

    loadDepositInvoiceArtifactPreview.mockRejectedValueOnce(new Error("Metadata read failed"));
    const failure = renderIntoDocument(<InvoiceArtifactPreviewDialog invoiceId="inv_1" invoiceRef="INV-1" onClose={vi.fn()} />);
    const failureModes = document.body.querySelector('[aria-label="Invoice artifact preview"]');
    await act(async () => { await Promise.resolve(); });
    expect(document.body.textContent).toContain("Unavailable");
    const retry = Array.from(document.body.querySelectorAll("button")).find((button) => button.textContent === "Retry")!;
    await act(async () => retry.click());
    expect(document.body.textContent).toContain("customer@example.invalid");
    expect(document.body.querySelector('[aria-label="Invoice artifact preview"]')).toBe(failureModes);
    failure.unmount();
  });

  it("never adopts an older invoice response or a mismatched initial preview", async () => {
    const seed = await loadDepositInvoiceArtifactPreview.getMockImplementation()!();
    let resolveOld!: (value: typeof seed) => void;
    loadDepositInvoiceArtifactPreview.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const view = renderIntoDocument(<InvoiceArtifactPreviewDialog invoiceId="inv_1" invoiceRef="INV-1" onClose={vi.fn()} />);
    let resolveNew!: (value: typeof seed) => void;
    loadDepositInvoiceArtifactPreview.mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    view.rerender(<InvoiceArtifactPreviewDialog invoiceId="inv_2" invoiceRef="INV-2" initialPreview={seed} onClose={vi.fn()} />);
    expect(document.body.textContent).not.toContain("customer@example.invalid");
    await act(async () => resolveOld(seed));
    expect(document.body.textContent).not.toContain("customer@example.invalid");
    await act(async () => resolveNew({ ...seed, invoiceId: "inv_2", subject: "Second invoice" }));
    expect(document.body.textContent).toContain("Second invoice");
    expect(document.body.textContent).not.toContain("Deposit invoice - INV-2026-0147");
    view.unmount();
  });

  it('clears already-loaded PDF evidence when the independent metadata read ends access, then verifies both again on Retry', async () => {
    let reject!: (error: Error) => void;
    loadDepositInvoiceArtifactPreview.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    const view = renderIntoDocument(<InvoiceArtifactPreviewDialog invoiceId="inv_1" invoiceRef="INV-1" onClose={vi.fn()} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    const owner = document.querySelector('[data-pdf-owner]');
    expect(owner?.querySelector('canvas')).not.toBeNull();
    await act(async () => reject(new ApiError('Access ended', { status: 403, body: null })));
    expect(document.querySelector('[data-pdf-owner]')).toBe(owner);
    expect(owner?.querySelector('canvas')).toBeNull();
    expect(owner?.textContent).toContain('Invoice access unavailable');
    await act(async () => { Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Retry')!.click(); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(document.querySelector('[data-pdf-owner]')).toBe(owner);
    expect(owner?.querySelector('canvas')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Access ended');
    view.unmount();
  });

});
