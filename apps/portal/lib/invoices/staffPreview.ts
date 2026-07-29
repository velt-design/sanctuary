import { renderDepositInvoiceEmail } from "../emails/invoice";
import type { FrozenInvoiceEmail } from "./deliveryIntent";
import { redactInvoiceToken } from "./deliveryIntent";
import {
  buildDepositInvoiceEmailInput,
  type DepositInvoiceEmailPresentationInput,
} from "./emailPresentation";
import type { DepositInvoiceArtifactPreview } from "./types";

export function preparedDepositInvoicePreview(params: {
  invoiceId: string;
  invoiceRef: string;
  frozen: FrozenInvoiceEmail;
  attachmentNames: string[];
}): DepositInvoiceArtifactPreview {
  return {
    invoiceId: params.invoiceId,
    invoiceRef: params.invoiceRef,
    subject: params.frozen.subject,
    html: redactInvoiceToken(params.frozen.html) ?? "",
    text: redactInvoiceToken(params.frozen.text),
    recipients: params.frozen.recipients,
    attachmentNames: params.attachmentNames,
    source: "prepared",
  };
}

export async function prospectiveDepositInvoicePreview(
  input: DepositInvoiceEmailPresentationInput & {
    invoiceId: string;
  },
): Promise<DepositInvoiceArtifactPreview> {
  const rendered = await renderDepositInvoiceEmail(
    buildDepositInvoiceEmailInput(input),
  );
  return {
    invoiceId: input.invoiceId,
    invoiceRef: input.invoiceRef,
    subject: input.subject,
    html: rendered.html,
    text: rendered.text ?? null,
    recipients: input.recipients,
    attachmentNames: input.attachmentNames ?? [],
    source: "prospective",
  };
}
