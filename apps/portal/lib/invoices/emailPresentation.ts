import type { DepositInvoiceEmailInput } from "../emails/invoice";
import {
  buildDepositInvoiceArtifactViewModel,
  type DepositInvoiceArtifactInput,
} from "./invoiceArtifactViewModel";
import type { InvoiceRecipientLists } from "./deliveryIntent";

type InvoiceEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type DepositInvoiceEmailPresentationInput =
  DepositInvoiceArtifactInput & {
    recipients: InvoiceRecipientLists;
    subject: string;
    invoiceLink: string;
    paymentLines: readonly string[];
    referenceId?: string;
    attachmentNames?: string[];
    attachments?: InvoiceEmailAttachment[];
  };

export function buildDepositInvoiceEmailInput(
  input: DepositInvoiceEmailPresentationInput,
): DepositInvoiceEmailInput {
  const viewModel = buildDepositInvoiceArtifactViewModel(
    input,
    input.paymentLines,
  );

  return {
    to: input.recipients.to,
    cc: input.recipients.cc,
    bcc: input.recipients.bcc,
    subject: input.subject,
    name: viewModel.customer.name,
    invoice_number: viewModel.header.invoiceRef,
    project_name: input.projectName?.trim() || undefined,
    project_address: input.projectAddress ?? undefined,
    quote_number: `${viewModel.header.quoteRef} v${viewModel.header.quoteVersionNumber}`,
    deposit_percent: `${viewModel.deposit.percent}%`,
    payment_stage: input.paymentTermLabel?.trim() || 'Initial payment',
    source_quote_total_inc_gst: viewModel.totals.quoteTotalIncGst,
    invoice_subtotal_ex_gst: viewModel.totals.totalExGst,
    invoice_gst: viewModel.totals.gst,
    invoice_total_inc_gst: viewModel.totals.totalIncGst,
    due_date: viewModel.dates.due,
    invoice_link: input.invoiceLink,
    payment_reference: viewModel.payment.reference,
    payment_lines: [...viewModel.payment.lines],
    contact_email: viewModel.footer.email,
    reference_id: input.referenceId,
    attachment_names: input.attachmentNames,
    attachments: input.attachments,
  };
}
