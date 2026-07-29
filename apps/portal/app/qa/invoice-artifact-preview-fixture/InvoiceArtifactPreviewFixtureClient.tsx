"use client";

import { useState } from "react";
import { Button } from "@/components/ui/foundation";
import type { DepositInvoiceArtifactPreview } from "@/lib/invoices/types";
import InvoiceArtifactPreviewDialog from "@/components/projects/ProjectPage/tabs/InvoiceArtifactPreviewDialog";

export default function InvoiceArtifactPreviewFixtureClient({
  preview,
}: {
  preview: DepositInvoiceArtifactPreview;
}) {
  const [open, setOpen] = useState(false);

  return (
    <main
      data-portal-qa-fixture="invoice-artifact-preview"
      style={{ padding: 24 }}
    >
      <h1>Invoice artifact preview fixture</h1>
      <p>Deterministic customer-data-free staff preview.</p>
      <Button type="button" onClick={() => setOpen(true)}>
        Preview invoice
      </Button>
      {open ? (
        <InvoiceArtifactPreviewDialog
          invoiceId={preview.invoiceId}
          invoiceRef={preview.invoiceRef}
          initialPreview={preview}
          pdfPreviewUrl="/api/qa/invoice-artifact-preview/pdf"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </main>
  );
}
