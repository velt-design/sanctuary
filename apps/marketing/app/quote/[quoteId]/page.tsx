import { loadPublicQuoteByToken } from '@/lib/quotes/publicQuote';

type QuotePageProps = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
};

function readQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  if (typeof value === 'string') return value.trim();
  return '';
}

function formatMoney(cents: number): string {
  const dollars = Number.isFinite(cents) ? cents / 100 : 0;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function statusLabel(status: string): string {
  const upper = status.trim().toUpperCase();
  if (upper === 'ACCEPTED') return 'Accepted';
  if (upper === 'SENT') return 'Sent';
  if (upper === 'DECLINED') return 'Declined';
  return 'Draft';
}

function errorText(code: string): string {
  switch (code) {
    case 'expired':
      return 'This quote link has expired.';
    case 'invalid_status':
      return 'This quote can no longer be accepted from this link.';
    case 'invalid':
      return 'This quote link is invalid.';
    default:
      return 'Unable to accept the quote. Please contact Sanctuary Pergolas.';
  }
}

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { quoteId } = await params;
  const qs = await searchParams;

  const token = readQueryString(qs.token);
  const acceptErrorCode = readQueryString(qs.error);

  if (!token) {
    return <main style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>Missing token.</main>;
  }

  const lookup = await loadPublicQuoteByToken({ quoteId, token });
  const quote = lookup.quote;

  if (!quote) {
    return (
      <main style={{ padding: 24, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        This quote link is invalid or has expired.
      </main>
    );
  }

  const isAccepted = quote.status === 'ACCEPTED';
  const isExpired = lookup.reason === 'expired';
  const canAccept = quote.status === 'SENT' && !isAccepted && !isExpired;

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 16, fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <h1 style={{ margin: '0 0 12px' }}>Quote</h1>

      <div style={{ border: '1px solid #e6e6e6', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 6 }}>
          <strong>Quote:</strong> {quote.quoteRef} v{quote.versionNumber}
        </div>
        {quote.projectName ? (
          <div style={{ marginBottom: 6 }}>
            <strong>Project:</strong> {quote.projectName}
          </div>
        ) : null}
        {quote.projectAddress ? (
          <div style={{ marginBottom: 6 }}>
            <strong>Site:</strong> {quote.projectAddress}
          </div>
        ) : null}
        <div style={{ marginBottom: 6 }}>
          <strong>Issued:</strong> {formatDate(quote.createdAt)}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>Valid until:</strong> {formatDate(quote.expiresAt)}
        </div>
        <div>
          <strong>Status:</strong> {statusLabel(quote.status)}
        </div>
      </div>

      <div style={{ border: '1px solid #e6e6e6', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ textAlign: 'left', padding: 12, borderBottom: '1px solid #e6e6e6' }}>Description</th>
              <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #e6e6e6', width: 100 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: 12, borderBottom: '1px solid #e6e6e6', width: 180 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lineItems.length ? (
              quote.lineItems.map((line) => (
                <tr key={line.id}>
                  <td style={{ padding: 12, borderBottom: '1px solid #f1f1f1' }}>{line.description || 'Line item'}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>{line.qty}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #f1f1f1', textAlign: 'right' }}>
                    {formatMoney(line.lineTotalIncGstCents)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ padding: 12 }} colSpan={3}>
                  No line items listed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Total (incl. GST)</span>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{formatMoney(quote.totalIncGstCents)}</span>
      </div>

      {acceptErrorCode ? (
        <div style={{ marginBottom: 12, padding: 12, background: '#fdecea', color: '#7a1f1f', borderRadius: 6 }}>
          {errorText(acceptErrorCode)}
        </div>
      ) : null}

      {isExpired ? (
        <div style={{ marginBottom: 12, padding: 12, background: '#f6f6f6', borderRadius: 6 }}>
          This quote link has expired. Please contact Sanctuary Pergolas for a refreshed quote link.
        </div>
      ) : null}

      {isAccepted ? (
        <div style={{ marginBottom: 12, padding: 12, background: '#f6f6f6', borderRadius: 6 }}>
          Quote accepted. We will be in touch to confirm scheduling.
        </div>
      ) : null}

      {!isAccepted ? (
        <form action={`/api/quotes/${encodeURIComponent(quoteId)}/accept`} method="post">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            disabled={!canAccept}
            style={{
              background: canAccept ? '#7F342D' : '#9d9d9d',
              color: 'white',
              padding: '12px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: canAccept ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            Accept quote
          </button>
        </form>
      ) : null}
    </main>
  );
}
