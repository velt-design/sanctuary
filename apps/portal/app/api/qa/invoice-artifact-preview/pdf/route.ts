import { generateDepositInvoicePdfBytesWithLayout } from "@/lib/invoices/pdf";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES !== "1") {
    return Response.json(
      { error: "Not found" },
      {
        status: 404,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }

  const { bytes } = await generateDepositInvoicePdfBytesWithLayout(
    {
      invoiceRef: "INV-2026-0147",
      quoteRef: "Q-2026-0084",
      quoteVersionNumber: 3,
      customerName: "Taylor Morgan",
      projectName: "Warkworth Courtyard",
      projectAddress: "18 Example Lane, Warkworth, Auckland",
      issueDate: "2026-07-01",
      dueDate: "2026-07-08",
      depositPercent: 50,
      quoteTotalIncGstCents: 575000,
      totalIncGstCents: 287500,
      totalExGstCents: 250000,
      gstCents: 37500,
    },
    {
      paymentLines: [
        "Fixture bank-transfer instructions.",
        "Fixture account name.",
        "Fixture account number.",
        "Use the invoice number as the payment reference.",
      ],
    },
  );

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="INV-2026-0147-fixture.pdf"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
