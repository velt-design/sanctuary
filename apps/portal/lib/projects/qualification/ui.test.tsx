import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import EnquiryQualification from '@/components/projects/qualification/EnquiryQualification';
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NOT_FOUND');}}));
import Fixture from '@/app/qa/enquiry-qualification-fixture/page';
const projectId='11111111-1111-4111-8111-111111111111',enquiryId='22222222-2222-4222-8222-222222222222';
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(()=>{mounted?.unmount();mounted=undefined;vi.unstubAllEnvs();});
it('disables fixture in production even with the fixture flag and requires explicit local enablement',()=>{
  vi.stubEnv('NODE_ENV','production');vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','1');expect(()=>Fixture()).toThrow('NOT_FOUND');
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES','0');expect(()=>Fixture()).toThrow('NOT_FOUND');
});
it('rejects mismatched source and exposes retry without a usable save action',async()=>{
  const transport=vi.fn().mockResolvedValue({qualification:{enquiryId:projectId}});
  await act(async()=>{mounted=renderIntoDocument(<EnquiryQualification projectId={projectId} enquiryId={enquiryId} transport={transport}/>);});
  expect(mounted!.container.textContent).toContain('could not be loaded');
  expect(mounted!.container.querySelector('form')).toBeNull();
});
