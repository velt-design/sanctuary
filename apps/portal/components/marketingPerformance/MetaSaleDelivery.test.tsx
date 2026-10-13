// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import MetaSaleDelivery from './MetaSaleDelivery';
import type { MetaSaleStatus } from '@/lib/marketingIntegrations/metaSales/contract';
const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
const status:MetaSaleStatus={enabled:false,deliveryAuthority:'DISABLED',mode:'canary',datasetId:'123',checkedAt:'2026-10-14T00:00:00Z',lastCompletedAt:null,error:null,pending:'NONE',counts:{},reasons:{},assessmentReasons:{META_EVENT_WINDOW_EXCEEDED:4,META_DISCLOSURE_NOT_PRESENT:5},assessedCount:6,assessedAt:'2026-10-14T00:00:00Z',warningCount:0};
afterEach(async()=>{await act(async()=>root.unmount());host.innerHTML='';root=createRoot(host);});
it('explains assessment exclusions without adding overlapping counts or implying a matched sale',async()=>{
  await act(async()=>root.render(<MetaSaleDelivery loader={async()=>status}/>));
  expect(host.textContent).toContain('Sale delivery is not active');expect(host.textContent).toContain('6 paid-scope records assessed');
  expect(host.textContent).toContain('must not be added together');expect(host.textContent).toContain('does not prove it matched');
  expect(host.querySelector('[aria-label="Meta sale attention"]')).toBeNull();
});
it('keeps failed delivery and corrections visible outside collapsed detail',async()=>{
  await act(async()=>root.render(<MetaSaleDelivery loader={async()=>({...status,error:'META_SALE_RUN_REQUIRES_REVIEW',pending:'EXPIRED',counts:{REVIEW_REQUIRED:2},warningCount:1})}/>));
  const attention=host.querySelector('[aria-label="Meta sale attention"]')!;expect(attention.closest('details')).toBeNull();
  expect(attention.textContent).toContain('2 sale delivery records');expect(attention.textContent).toContain('without confirmation');
});
it('clears stale evidence on failed refresh and permits recovery',async()=>{
  const loader=vi.fn().mockResolvedValueOnce(status).mockRejectedValueOnce(Error()).mockResolvedValueOnce({...status,enabled:true,deliveryAuthority:'READY'});
  await act(async()=>root.render(<MetaSaleDelivery loader={loader}/>));await act(async()=>host.querySelector('button')!.click());
  expect(host.textContent).toContain('could not be checked');expect(host.textContent).not.toContain('6 paid-scope');
  await act(async()=>host.querySelector('button')!.click());expect(host.textContent).toContain('restricted to one selected sale');
});
it.each(['CREDENTIAL_EXPIRED','ACTOR_UNAVAILABLE'] as const)('shows %s without falsely claiming routine delivery is active',async(deliveryAuthority)=>{
  await act(async()=>root.render(<MetaSaleDelivery loader={async()=>({...status,enabled:true,mode:'routine',deliveryAuthority})}/>));
  expect(host.textContent).toContain('Sale delivery is not active');
  const attention=host.querySelector('[aria-label="Meta sale attention"]')!;
  expect(attention.closest('details')).toBeNull();expect(attention.textContent).toMatch(/credential|operator/);
  expect(host.textContent).not.toContain('Automatic delivery is enabled');
});
