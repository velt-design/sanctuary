import { describe, expect, it } from 'vitest';
import { hubSchema, hubDefaults, selectHub } from '@/lib/marketingPerformance/hub';
import { summarize } from '@/lib/marketingPerformance/contract';
import { representativeFixture as data, representativeFilters } from './representativeFixture';

describe('representative review scenario',()=>{
  it('reconciles distinct projects, receipt gaps, repeats and outcomes at realistic scale',()=>{
    expect(hubSchema.safeParse(data).success).toBe(true);
    expect(summarize(data.enquiries.rows)).toMatchObject({enquiries:1052,projects:1000,origins:1000,repeats:2,unlinked:50,attributed:45,quote:85,accepted:25,won:13});
    expect(data.projects.filter(p=>!p.receiptCount)).toHaveLength(200);
    expect(data.projects.filter(p=>p.state==='ARCHIVED')).toHaveLength(350);
    for(const p of data.projects){
      const receipts=data.enquiries.rows.filter(r=>r.projectId===p.id);
      expect(receipts.length).toBe(p.receiptCount);
      const origin=receipts.find(r=>r.origin);
      expect(origin?.enquiryId??null).toBe(p.originId);
      expect(origin?.source??null).toBe(p.source);
      expect(origin?.won??false).toBe(p.paymentVerified);
    }
  });
  it('keeps filtered card sets inspectable and dated activity after project creation',()=>{
    const base=hubDefaults(representativeFilters);
    expect(selectHub(data,{...base,view:'portfolio',evidence:'no_receipt'}).projects).toHaveLength(200);
    expect(selectHub(data,{...base,view:'portfolio',evidence:'paid_gap'}).projects).toHaveLength(44);
    expect(selectHub(data,{...base,inspect:'payment'}).enquiries).toHaveLength(13);
    const projects=new Map(data.projects.map(p=>[p.id,p]));
    for(const e of data.events) expect(e.day>=projects.get(e.projectId)!.createdAt.slice(0,10)).toBe(true);
    expect(data.events.filter(e=>e.projectId===data.projects[0].id).reduce((sum,e)=>sum+(e.amountCents??0),0)).toBe(0);
    expect(data.projects[0].paymentVerified).toBe(false);
  });
});
