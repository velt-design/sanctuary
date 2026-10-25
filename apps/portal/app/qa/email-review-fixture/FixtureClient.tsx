'use client';
import { useEffect, useState } from 'react';
import EmailReviewWorkspace from '@/components/emailReview/EmailReviewWorkspace';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { createFixtureApi } from './fixtureApi';
export default function FixtureClient({progressive=false,failure=false}:{progressive?:boolean;failure?:boolean}) {
  const [api, setApi] = useState<ReturnType<typeof createFixtureApi> | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {const next=createFixtureApi(window.localStorage);if(progressive){const source={session:next.session,page:next.page,item:next.item};let fail=failure;
    next.session=async()=>{await new Promise(resolve=>setTimeout(resolve,350));return source.session();};
    next.page=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,900));return source.page(...args);};
    next.item=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,1200));if(fail){fail=false;throw new Error('Synthetic selected-draft read failure.');}return source.item(...args);};
  }setApi(next); }, [progressive,failure]);
  if (!api) return <p>Loading synthetic preview…</p>;
  return <><aside aria-label="Synthetic test controls">{progressive&&<p>Controlled fictional reads: session350 ms, list900 ms, selected draft1200 ms. All saves remain browser-only synthetic examples. No email is sent.</p>}<Button variant="quiet" onClick={() => { api.conflictNext(); setNotice('The next save will simulate another reviewer’s edit.'); }}>Simulate next-save conflict</Button><Button variant="quiet" onClick={() => { api.failNext(); setNotice('The next save will simulate an unavailable service.'); }}>Simulate next-save failure</Button><Button variant="quiet" onClick={() => { if (window.confirm('Reset all synthetic review changes?')) { api.reset(); window.location.reload(); } }}>Reset examples</Button><span role="status">{notice}</span></aside><EmailReviewWorkspace api={api} synthetic /></>;
}
