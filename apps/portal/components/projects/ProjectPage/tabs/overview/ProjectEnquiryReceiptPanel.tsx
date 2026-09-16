'use client';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import { DataStatePanel } from '@/components/ui/foundation';
import { enquiryDeliveryStatus } from './enquiryDeliveryStatus';

type Receipt = {
  id: string; submittedAt: string; receiptFrozen: boolean; requestType: string | null;
  customerBrief: { audience?: string; designStatus?: string; summary?: string; reopenPath?: string } | null;
  preferences: { preferredTiming?: string; budgetPreference?: string; budgetHint?: string } | null;
  submittedPrice: { includesGst?: boolean; baseRange?: MoneyRange | null; blindsRange?: MoneyRange | null; breakdown?: { label: string; amountIncGst: number }[] } | null;
  message: string | null; emailStatus: string | null; deliveryStatus?: string | null;
};
type MoneyRange = { lowIncGst: number; highIncGst: number };

const money = (amount: number) => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(amount);
const rangeLabel = (range: MoneyRange | null | undefined) => range && Number.isFinite(range.lowIncGst) && Number.isFinite(range.highIncGst)
  ? `${money(range.lowIncGst)}${range.lowIncGst !== range.highIncGst ? `–${money(range.highIncGst)}` : ''} including GST` : 'To be confirmed';

export default function ProjectEnquiryReceiptPanel({ projectId, host }: { projectId: string; host: string }) {
  const query = useQuery({
    queryKey: ['project-enquiry-receipts', host, projectId],
    queryFn: () => apiJson<{ receipts: Receipt[] }>(`/api/staff/projects/${encodeURIComponent(projectId)}/enquiry-receipts`),
    staleTime: 30_000,
  });
  if (query.isPending) return <p role="status">Loading original enquiry…</p>;
  if (query.isError) return <DataStatePanel state="error" title="Original enquiry unavailable" description="The saved enquiry could not be loaded." onRetry={() => void query.refetch()} />;
  if (!query.data.receipts.length) return <p>No website enquiry is linked to this project.</p>;
  return <div>{query.data.receipts.map(receipt => {
    const brief = receipt.customerBrief;
    const price = receipt.submittedPrice?.baseRange;
    const path = brief?.reopenPath;
    const designUrl = path && /^\/configurator-preview\?open=1#design=[^\s<>]+$/.test(path)
      ? `https://www.sanctuarypergolas.co.nz${path}` : null;
    return <section key={receipt.id} aria-label="Original customer enquiry">
      <h3>{receipt.requestType === 'site-measure' ? 'Site measure request' : 'Project discussion'}</h3>
      <p>{new Date(receipt.submittedAt).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} · {brief?.audience ?? 'Website enquiry'} · {brief?.designStatus ?? 'Details below'}</p>
      <p>{receipt.receiptFrozen ? 'Original submitted record. Later changes to the working estimate do not change this receipt.' : 'Legacy enquiry. An immutable submitted price was not recorded; confirm pricing with the customer.'}</p>
      {brief?.summary && <p>{brief.summary}</p>}
      {designUrl && <><p><a href={designUrl} target="_blank" rel="noopener noreferrer">Open submitted design</a> · Reopening shows current pricing; use this receipt for the submitted estimate.</p>
        <p><a href={`/staff/projects/${encodeURIComponent(projectId)}/configurator-revision`}>Revise configured design</a> · Save a new estimate on this project.</p></>}
      <dl>
        <dt>Pergola estimate at submission</dt><dd>{receipt.submittedPrice?.includesGst ? rangeLabel(price) : 'To be confirmed'}</dd>
        {receipt.submittedPrice?.blindsRange && <><dt>Blinds estimate at submission</dt><dd>{receipt.submittedPrice.includesGst ? rangeLabel(receipt.submittedPrice.blindsRange) : 'To be confirmed'}</dd></>}
        {receipt.preferences?.preferredTiming && <><dt>Preferred timing</dt><dd>{receipt.preferences.preferredTiming}</dd></>}
        {receipt.preferences?.budgetPreference && <><dt>Customer’s budget preference</dt><dd>{receipt.preferences.budgetPreference === 'not-sure' ? 'Not sure yet' : receipt.preferences.budgetHint || 'Not supplied'}</dd></>}
        <dt>Confirmation email</dt><dd>{enquiryDeliveryStatus(receipt.emailStatus, receipt.deliveryStatus)}</dd>
      </dl>
      {receipt.submittedPrice?.includesGst && receipt.submittedPrice.breakdown?.length ? <details><summary>Submitted price breakdown · including GST</summary><dl>{receipt.submittedPrice.breakdown.map((line, index) => <div key={index}><dt>{line.label}</dt><dd>{rangeLabel({ lowIncGst: line.amountIncGst, highIncGst: line.amountIncGst })}</dd></div>)}</dl></details> : null}
      {receipt.message && <p style={{ whiteSpace: 'pre-wrap' }}>{receipt.message}</p>}
      <p>Review the site and contact the customer before arranging a visit. Free site measures are available in Auckland; confirm availability and any travel cost elsewhere.</p>
    </section>;
  })}</div>;
}
