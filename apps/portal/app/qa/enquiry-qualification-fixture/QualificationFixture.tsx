'use client';
import { useCallback, useRef, useState } from 'react';
import EnquiryQualification, { type QualificationTransport } from '@/components/projects/qualification/EnquiryQualification';
import { ApiError } from '@/lib/repo/apiClient';
import type { QualificationView } from '@/lib/projects/qualification/contract';
const projectId = '11111111-1111-4111-8111-111111111111';
const enquiryId = '22222222-2222-4222-8222-222222222222';
function initialView(): QualificationView {
  return { projectId,enquiryId,eligible:true,history:[],current:{version:0,state:'unreviewed',
    criteria:{location:null,project:null,contactAndConfiguration:null,intent:null},reason:'',actorId:null,actorEmail:null,recordedAt:null,criteriaVersion:'configured-enquiry-v1'} };
}
type Scenario = 'success' | 'failure' | 'lost-response' | 'conflict' | 'read-failure' | 'mismatch';
// Only this development fixture supplies transport. Production props have no request/URL injection.
export default function QualificationFixture() {
  const saved = useRef(initialView());
  const scenario = useRef<Scenario>('success');
  const commands = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const [writes, setWrites] = useState(0);
  const transport = useCallback<QualificationTransport>(async (_path, command) => {
    if (scenario.current === 'read-failure') throw new Error('Synthetic read failure');
    if (scenario.current === 'mismatch') return {qualification:{...saved.current,enquiryId:projectId}};
    if (command) {
      setWrites(value => value + 1);
      if (scenario.current === 'failure') throw new Error('Synthetic save failure');
      if (scenario.current === 'conflict') throw new ApiError('Synthetic competing review',{status:409,body:null});
      if (!commands.current.has(command.commandId)) {
        if (command.expectedVersion !== saved.current.current.version) throw new ApiError('Stale review',{status:409,body:null});
        const decision = {...saved.current.current,...command,version:saved.current.current.version+1,
          actorId:projectId,actorEmail:'synthetic.staff@example.test',recordedAt:new Date().toISOString()};
        saved.current={...saved.current,current:decision,history:[decision,...saved.current.history]};
        commands.current.add(command.commandId);
        if (scenario.current === 'lost-response') { scenario.current='success'; throw new Error('Saved, but response lost'); }
      }
    }
    return {qualification:structuredClone(saved.current)};
  },[]);
  return <div style={{maxWidth:820,margin:'0 auto'}}>
    <label>Simulated response <select defaultValue="success" onChange={event => { scenario.current=event.target.value as Scenario; }}>
      <option value="success">Success</option><option value="failure">Save unavailable</option><option value="lost-response">Save commits, response lost once</option>
      <option value="conflict">Conflicting review</option><option value="read-failure">Read unavailable</option><option value="mismatch">Wrong enquiry returned</option>
    </select></label>
    <button type="button" onClick={() => { saved.current=initialView();commands.current.clear();setWrites(0);setVersion(value=>value+1); }}>Reset sample</button>
    <p>Save attempts: {writes}. The controls below use the actual staff form with a fixture-only in-memory transport.</p>
    <section aria-label="Original customer enquiry"><h3>Project discussion · synthetic enquiry</h3>
      <p>17 September 2026 · Residential · Configured</p>
      <p>Original submitted record. Pitched pergola · 4 m wide × 3 m projection · Auckland. Synthetic contact: enquiry@example.test. “Please discuss a quote.”</p>
      <EnquiryQualification key={version} projectId={`proj_${projectId}`} enquiryId={enquiryId} transport={transport} />
    </section>
  </div>;
}
