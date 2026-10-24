"use client";

import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/foundation";
import type { DepositInvoiceArtifactPreview } from "@/lib/invoices/types";
import InvoiceArtifactPreviewDialog from "@/components/projects/ProjectPage/tabs/InvoiceArtifactPreviewDialog";

export default function InvoiceArtifactPreviewFixtureClient({
  preview,
  progressive = false,
}: {
  preview: DepositInvoiceArtifactPreview;
  progressive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!progressive) return;
    const original = window.fetch, failed = new Set<string>();
    const failure = new URL(window.location.href).searchParams.get("readFailure") === "1";
    window.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      const metadata = url.pathname === `/api/staff/v1/invoices/${preview.invoiceId}/preview`;
      if ((init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase() !== "GET" || (!metadata && url.pathname !== "/api/qa/invoice-artifact-preview/pdf")) return Response.json({ error: "Read-only fictional preview. Commands unavailable." }, { status: 403 });
      await new Promise((resolve) => setTimeout(resolve, metadata ? 1400 : 700));
      if (failure && !failed.has(url.pathname)) { failed.add(url.pathname); return Response.json({ error: "Synthetic preview read failed. Retry the same source." }, { status: 503 }); }
      return metadata ? Response.json({ preview }) : original(input, init);
    };
    return () => { window.fetch = original; };
  }, [preview, progressive]);

  return (
    <main
      data-portal-qa-fixture="invoice-artifact-preview"
      style={{ padding: 24 }}
    >
      <h1>Invoice artifact preview fixture</h1>
      <p>Deterministic customer-data-free staff preview.{progressive ? " Controlled local metadata 1400 ms / PDF 700 ms; all commands rejected. Not production timing." : ""}</p>
      <Button type="button" onClick={() => setOpen(true)}>
        Preview invoice
      </Button>
      {open ? (
        <InvoiceArtifactPreviewDialog
          invoiceId={preview.invoiceId}
          invoiceRef={preview.invoiceRef}
          initialPreview={progressive ? undefined : preview}
          pdfPreviewUrl="/api/qa/invoice-artifact-preview/pdf"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </main>
  );
}
