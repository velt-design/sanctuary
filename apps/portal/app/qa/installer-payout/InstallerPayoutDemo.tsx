'use client';
import { useCallback, useRef } from 'react';
import InstallerPayoutPage from '@/components/installerPayouts/InstallerPayoutPage';
import { buildPayoutEvent, money, type PayoutEvent } from '@/lib/installerPayouts/model';

export default function InstallerPayoutDemo() {
  const events = useRef<PayoutEvent[]>([{
    id: 'demo-agreement', sequence: 1, kind: 'agreement', created_at: '2026-09-11T00:00:00Z', created_by: 'Demo admin',
    payload: { installer: 'Example installation crew', scope: '6 × 3 m pitched pergola — frame and acrylic roof installation at ground level.',
      exclusions: 'Electrical work, excavation and extra return visits.', paymentTerms: 'Example only — payment after agreed completion.',
      acceptanceReference: 'Demonstration agreement; no actual installer acceptance.', gstRegistered: true,
      sourceQuoteId: 'DEMO-QUOTE', sourceEstimateId: 'DEMO-ESTIMATE', ...money(1886.96, true) },
  }]);
  const transport = useCallback<typeof fetch>(async (_url, init) => {
    if (init?.method !== 'POST') return Response.json({ events: events.current, canEdit: true });
    try {
      const body = JSON.parse(String(init.body));
      if (body.action !== 'variation' && body.action !== 'invoice') throw new Error('This preview starts with an example confirmed agreement.');
      const payload = buildPayoutEvent(body.action, body, events.current);
      events.current = [...events.current, { id: body.commandId, sequence: events.current.length + 1, kind: body.action, payload, created_at: new Date().toISOString(), created_by: 'Demo admin' }];
      return Response.json({ saved: true });
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Check the entry.' }, { status: 400 }); }
  }, []);
  return <><p style={{ padding: '16px 24px', borderBottom: '1px solid currentColor' }}><strong>Preview only — example data.</strong> Try adding a variation or invoice. Changes last until you reload; nothing is saved to the portal or sent to anyone.</p><InstallerPayoutPage projectId="DEMO-6X3" transport={transport} /></>;
}
