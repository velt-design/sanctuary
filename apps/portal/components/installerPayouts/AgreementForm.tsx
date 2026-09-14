'use client';
import { useState } from 'react';
import { Button, Input, Textarea } from '@/components/ui/foundation';
import { dollars } from './PayoutSheet';
type Preview = { fingerprint: string; calculation: { modelAllowanceExGst: number; proposal: { benchmarkExGst: number; transitionTopUpExGst: number; payoutExGst: number; gst: number; totalPayable: number } } };
export function AgreementForm({ request, busy }: { request: (body: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const [fields, setFields] = useState({ installer: '', scope: '', exclusions: 'None', paymentTerms: '', acceptanceReference: '', evidenceReference: '', benchmarkExGst: '' });
  const [gstRegistered, setGst] = useState(true), [scopeMatched, setMatched] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const update = (key: keyof typeof fields, value: string) => { setFields(p => ({ ...p, [key]: value })); setPreview(null); };
  const body = { ...fields, benchmarkExGst: fields.benchmarkExGst === '' ? null : Number(fields.benchmarkExGst), gstRegistered, scopeMatched };
  return <section><h2>Review a new agreement</h2>
    <p>The model uses the accepted quote’s estimate and the current published pricebook. Check that the benchmark includes the same work; timber jobs and split contracts need a separate review.</p>
    <fieldset disabled={busy}>
      <Input label="Installer / crew receiving payment" value={fields.installer} onChange={e => update('installer', e.target.value)} />
      <Textarea label="Included installation scope" value={fields.scope} onChange={e => update('scope', e.target.value)} />
      <Textarea label="Exclusions" value={fields.exclusions} onChange={e => update('exclusions', e.target.value)} />
      <Input label="Payment terms" value={fields.paymentTerms} onChange={e => update('paymentTerms', e.target.value)} />
      <Input label="Installer acceptance reference (email, conversation and date)" value={fields.acceptanceReference} onChange={e => update('acceptanceReference', e.target.value)} />
      <Input label="Old-pay benchmark excluding GST (NZD)" type="number" min="0" step="0.01" value={fields.benchmarkExGst} onChange={e => update('benchmarkExGst', e.target.value)} />
      <p>The old base formula includes GST. Divide its total by 1.15 before entering it here.</p>
      <Input label="Benchmark evidence / calculation reference" value={fields.evidenceReference} onChange={e => update('evidenceReference', e.target.value)} />
      <label><input type="checkbox" checked={gstRegistered} onChange={e => { setGst(e.target.checked); setPreview(null); }} /> Installer is GST registered</label>
      <label><input type="checkbox" checked={scopeMatched} onChange={e => { setMatched(e.target.checked); setPreview(null); }} /> I have checked that the benchmark and model cover the same installation work</label>
      <Button onClick={() => { void request({ ...body, action: 'preview' }).then(result => { if (result) setPreview(result as Preview); }); }}>Review payout</Button>
      {preview && <div aria-live="polite"><h3>Proposed agreement</h3>
        <p>Model allowance: {dollars(preview.calculation.modelAllowanceExGst)} excluding GST<br />Old-pay benchmark: {dollars(preview.calculation.proposal.benchmarkExGst)} excluding GST<br />Transition top-up: {dollars(preview.calculation.proposal.transitionTopUpExGst)} excluding GST</p>
        <p><strong>{dollars(preview.calculation.proposal.totalPayable)} payable</strong> including {dollars(preview.calculation.proposal.gst)} GST.</p>
        <p>Confirm only after the installer has agreed the scope, amount and payment terms. This freezes the agreement; it does not send a message or pay an invoice.</p>
        <Button onClick={() => { void request({ ...body, action: 'agreement', fingerprint: preview.fingerprint }); }}>Confirm agreed payout</Button>
      </div>}
    </fieldset>
  </section>;
}
