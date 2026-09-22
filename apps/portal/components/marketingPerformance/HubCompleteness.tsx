import { Card } from '@/components/ui/foundation/FoundationSurfaces';
import { Button } from '@/components/ui/foundation/FoundationControls';
import { type HubReport, type HubFilters, hubDefaults } from '@/lib/marketingPerformance/hub';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { summarize } from '@/lib/marketingPerformance/contract';
import styles from './MarketingPerformance.module.css';

export default function HubCompleteness({hub,filters,apply}:{hub:HubReport;filters:HubFilters;apply:(f:HubFilters)=>void}) {
  const totals=summarize(hub.enquiries.rows),p=hub.projects;
  const inspect=(view:HubFilters['view'],evidence:string)=>apply({...hubDefaults(filters),source:'',campaign:'',view,evidence});
  return <Card title="Data completeness & reconciliation" padding="compact">
    <p className={styles.muted}>Whole portfolio and selected receipt dates, before source/owner/stage/evidence filters. These lists open with those filters cleared; nothing is edited automatically.</p>
    <div className={styles.hubActions}>
      <Button variant="secondary" onClick={()=>inspect('portfolio','no_receipt')}>{p.filter(r=>r.receiptCount===0).length} projects without receipts</Button>
      <Button variant="secondary" onClick={()=>inspect('enquiries','unlinked')}>{totals.unlinked} unlinked submissions</Button>
      <Button variant="secondary" onClick={()=>inspect('enquiries','unknown_source')}>{totals.enquiries-totals.attributed} submissions without source</Button>
      <Button variant="secondary" onClick={()=>inspect('portfolio','paid_gap')}>{p.filter(r=>normalizePipelineStageKey(r.stage)==='paid'&&!r.paymentVerified).length} paid-stage evidence gaps</Button>
      <Button variant="secondary" onClick={()=>inspect('enquiries','test')}>Review test-labelled submissions</Button>
    </div>
    <details><summary>How these populations fit together</summary>
      <p>{p.length} total projects = {p.filter(r=>r.state!=='ARCHIVED').length} non-archived + {p.filter(r=>r.state==='ARCHIVED').length} archived. Includes {p.filter(r=>r.knownTest).length} established test project(s), excluded from enquiry and sales reporting.</p>
      <p>{totals.enquiries} saved submissions in these dates = {totals.origins} origin submissions + {totals.repeats} repeat submissions + {totals.unlinked} unlinked submissions. They link to {totals.projects} distinct projects; repeat-only projects may have their origin outside these dates.</p>
      <p>Earliest saved enquiry: {hub.earliestReceipt?new Date(hub.earliestReceipt).toLocaleDateString('en-NZ',{timeZone:'Pacific/Auckland',dateStyle:'medium'}):'Unavailable'}. Earlier periods have no saved receipt history; later history can still be incomplete.</p>
      <p>Source/campaign uses consent-permitted observed intake evidence. Customer-reported discovery and Google/Meta conversion claims are separate and are not connected here. Missing source is never reconstructed from project stage or payment.</p>
      <p>Possible tests are label matches, not confirmed exclusions. Unreviewed qualification and missing confirmations remain unknown. Correct historical records only after checking their original evidence.</p>
    </details>
  </Card>;
}
