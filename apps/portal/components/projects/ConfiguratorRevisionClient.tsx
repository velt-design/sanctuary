'use client';
import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {apiJson} from '@/lib/repo/apiClient';
import {buildStaffConfiguratorEditUrl, configuratorRevisionRequestId} from '@/lib/projects/configuratorRevisionNavigation';
import {Button, ButtonLink, Card, DataStatePanel} from '@/components/ui/foundation';

type Price = {amountIncGst: number; includesGst: boolean; currency: string; breakdown: {label: string; amountIncGst: number}[]};
type Prepared = {preparationHash: string; price: Price};
type Source = {projectId: string; sourceEstimateId: string; design: unknown; marketingOrigin: string};
const money = (value: number) => new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD',maximumFractionDigits:0}).format(value);

export default function ConfiguratorRevisionClient({projectId, sourceEstimateId}: {projectId: string; sourceEstimateId?: string}) {
  const endpoint = `/api/staff/projects/${encodeURIComponent(projectId)}/configurator-revisions`;
  const source = useQuery({queryKey: ['configurator-revision-source',projectId,sourceEstimateId],
    queryFn: () => apiJson<Source>(endpoint + (sourceEstimateId ? `?sourceEstimateId=${encodeURIComponent(sourceEstimateId)}` : ''))});
  const [invalidReturn,setInvalidReturn] = useState(false);
  const [returned, setReturned] = useState<unknown>(null), [origin, setOrigin] = useState<string>();
  const [prepared,setPrepared] = useState<Prepared | null>(null), [error,setError] = useState('');
  const [busy,setBusy] = useState(false), [saved,setSaved] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    const text = new URLSearchParams(window.location.hash.slice(1)).get('revisionDraft');
    if (text) {
      try { if (text.length > 16000) throw new Error(); setReturned(JSON.parse(text)); }
      catch { setInvalidReturn(true); setError('The returned design could not be read. Reopen the saved design to try again.'); }
    }
  }, []);
  async function run(action: 'prepare' | 'save') {
    if (!source.data || invalidReturn) return;
    setBusy(true); setError('');
    if (action === 'prepare') setPrepared(null);
    try {
      const result = await apiJson<Prepared & {status: string}>(endpoint, {method:'POST', body:JSON.stringify({action,
        sourceEstimateId: source.data.sourceEstimateId, design: returned ?? source.data.design,
        requestId: prepared ? configuratorRevisionRequestId(prepared.preparationHash) : undefined, preparationHash: prepared?.preparationHash})});
      if (action === 'prepare' && result.status === 'prepared') setPrepared(result);
      else if (action === 'save' && result.status === 'saved') setSaved(true);
      else throw new Error('The revision could not be confirmed. Please retry.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The revision could not be saved. Please retry.'); }
    finally { setBusy(false); }
  }
  if (source.isPending) return <p role="status">Loading configured design…</p>;
  if (source.isError || !source.data) return <DataStatePanel state="error" title="Configured design unavailable" description="The saved design could not be loaded." onRetry={() => void source.refetch()} />;
  const editUrl = buildStaffConfiguratorEditUrl(source.data.marketingOrigin,source.data.projectId,source.data.sourceEstimateId,returned ?? source.data.design,origin);
  return <Card>
    <h2>{saved ? 'Revision saved' : returned ? 'Review your revised design' : 'Edit the configured design'}</h2>
    <p>The original customer enquiry remains unchanged. Saving creates a new estimate on this project and sends no customer email.</p>
    {error && <p role="alert">{error}</p>}
    {!saved && <>
      <p><ButtonLink href={editUrl}>{returned ? 'Edit design again' : 'Open configurator'}</ButtonLink></p>
      <p>Make your changes, then choose “Review revision in portal” in the configurator.</p>
      <Button disabled={busy || invalidReturn} onClick={() => void run('prepare')}>{busy ? 'Working…' : 'Calculate revised price'}</Button>
      {prepared && <section aria-label="Revised installed estimate">
        <h3>{money(prepared.price.amountIncGst)} including GST</h3>
        <dl>{prepared.price.breakdown.map((line,index) => <div key={index}><dt>{line.label}</dt><dd>{money(line.amountIncGst)}</dd></div>)}</dl>
        <p>Review the site before issuing a quote. This save does not book a visit.</p>
        <Button disabled={busy} onClick={() => void run('save')}>Save as new estimate</Button>
      </section>}
    </>}
    <p><ButtonLink href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates`}>Back to project estimates</ButtonLink></p>
  </Card>;
}
