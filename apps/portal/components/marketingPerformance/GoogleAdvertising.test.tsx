// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,expect,it,vi } from 'vitest';
import GoogleAdvertising from './GoogleAdvertising';
import { googleFixture } from '@/app/qa/marketing-performance-fixture/googleFixtures';
const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
afterEach(async()=>{await act(async()=>root.unmount());host.innerHTML='';root=createRoot(host);});
it('renders independent source dates, mapped outcomes and honest ingestion coverage',async()=>{
  await act(async()=>root.render(<GoogleAdvertising loader={async()=>googleFixture()}/>));
  expect(host.textContent).toContain('Report dates are independent');expect(host.textContent).toContain('0.75');expect(host.textContent).toContain('$610.00');
  expect(host.textContent).toContain('Google ingestion confirmed');expect(host.textContent).toContain('established separately');
  expect(host.textContent).toContain('not banked cash');
});
it('retains unavailable mappings and clears private evidence when a reload fails',async()=>{
  const loader=vi.fn().mockResolvedValueOnce(googleFixture('unmapped')).mockRejectedValueOnce(Error('denied'));
  await act(async()=>root.render(<GoogleAdvertising loader={loader}/>));expect(host.textContent).toContain('Not mapped');
  await act(async()=>{(host.querySelector('button') as HTMLButtonElement).click();});
  expect(host.textContent).toContain('could not be verified');expect(host.textContent).not.toContain('Demo non-brand');
});
it('never displays unavailable source evidence as zero advertising performance',async()=>{
  await act(async()=>root.render(<GoogleAdvertising loader={async()=>googleFixture('missing')}/>));
  expect(host.textContent).toContain('does not mean zero');expect(host.querySelector('table')).toBeNull();
});
it.each(['stale','report-failed','sales-failed','quarantined','diagnostics'])('keeps %s attention visible outside collapsed recovery details',async(mode)=>{
  await act(async()=>root.render(<GoogleAdvertising loader={async()=>googleFixture(mode)}/>));
  const attention=host.querySelector('[aria-label="Google advertising attention"]');expect(attention).not.toBeNull();expect(attention!.closest('details')).toBeNull();
  expect(attention!.textContent).toContain('1 sale record needs review');expect(attention!.textContent).toContain('1 cancellation is awaiting confirmation');
  if(mode==='report-failed'||mode==='stale')expect(attention!.textContent).toContain('Google report refresh needs review');
  if(mode==='sales-failed')expect(attention!.textContent).toContain('Sale delivery needs review');
  if(mode==='quarantined')expect(attention!.textContent).toContain('before either connection can run');
});
it('does not add an attention notice to healthy completed delivery',async()=>{
  await act(async()=>root.render(<GoogleAdvertising loader={async()=>googleFixture('clean')}/>));
  expect(host.querySelector('[aria-label="Google advertising attention"]')).toBeNull();
});
