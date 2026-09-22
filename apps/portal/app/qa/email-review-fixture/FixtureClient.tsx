'use client';
import { useEffect, useState } from 'react';
import EmailReviewWorkspace from '@/components/emailReview/EmailReviewWorkspace';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { createFixtureApi } from './fixtureApi';
export default function FixtureClient() {
  const [api, setApi] = useState<ReturnType<typeof createFixtureApi> | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => { setApi(createFixtureApi(window.localStorage)); }, []);
  if (!api) return <p>Loading synthetic preview…</p>;
  return <><aside aria-label="Synthetic test controls"><Button variant="quiet" onClick={() => { api.conflictNext(); setNotice('The next save will simulate another reviewer’s edit.'); }}>Simulate next-save conflict</Button><Button variant="quiet" onClick={() => { api.failNext(); setNotice('The next save will simulate an unavailable service.'); }}>Simulate next-save failure</Button><Button variant="quiet" onClick={() => { if (window.confirm('Reset all synthetic review changes?')) { api.reset(); window.location.reload(); } }}>Reset examples</Button><span role="status">{notice}</span></aside><EmailReviewWorkspace api={api} synthetic /></>;
}
