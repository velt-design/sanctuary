import type { Metadata } from 'next';
import { loadPublicDepositInvoiceByToken } from '@/lib/invoices/publicInvoice';
import { InvoiceDocument, InvoiceUnavailable } from './InvoiceDocument';

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function readQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  if (typeof value === 'string') return value.trim();
  return '';
}

function unavailableDescription(reason: 'invalid' | 'expired' | 'void' | undefined): string {
  if (reason === 'expired') {
    return 'This invoice link has expired. Contact Sanctuary for a refreshed link.';
  }
  if (reason === 'void') {
    return 'This invoice is no longer active. Contact Sanctuary if you need a replacement or clarification.';
  }
  return 'This invoice link is invalid or unavailable. Check the complete link from your email or contact Sanctuary.';
}

export default async function InvoicePage({ params, searchParams }: InvoicePageProps) {
  const { invoiceId } = await params;
  const qs = await searchParams;
  const token = readQueryString(qs.token);

  if (!token) {
    return (
      <InvoiceUnavailable
        title="Missing invoice token"
        description="This invoice link is incomplete. Use the full link from your email or contact Sanctuary."
      />
    );
  }

  const lookup = await loadPublicDepositInvoiceByToken({ invoiceId, token });
  const invoice = lookup.invoice;

  if (!invoice) {
    return <InvoiceUnavailable title="Invoice unavailable" description={unavailableDescription(lookup.reason)} />;
  }

  const pdfHref = invoice.pdfFileId ? `/api/invoices/${encodeURIComponent(invoiceId)}/pdf?token=${encodeURIComponent(token)}` : null;
  const quoteHref = invoice.quotePdfFileId
    ? `/api/invoices/${encodeURIComponent(invoiceId)}/quote-pdf?token=${encodeURIComponent(token)}`
    : null;

  return <InvoiceDocument invoice={invoice} pdfHref={pdfHref} quoteHref={quoteHref} />;
}
