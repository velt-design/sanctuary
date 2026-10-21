import { describe,it,expect } from 'vitest';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { designerPerformance,afterVisit,median } from './designer';
import { designerReportSchema } from './designerContract';
describe('designer attribution and coverage',()=>{
  it('selects assigned sales independently from actual attendee workload without fabricating missing attribution',()=>{
    const r=designerFixture();r.visits[0].staff=['joe'];
    const jordan=designerPerformance(r,null,'jordan');expect(jordan.total.outcomes).toHaveLength(1);expect(jordan.total.outcomes[0].visit.staff).toEqual(['joe']);
    expect(jordan.total.attended.map(v=>v.id)).not.toContain(r.visits[0].id);
    const joe=designerPerformance(r,null,'joe');expect(joe.total.attended.map(v=>v.id)).toContain(r.visits[0].id);expect(joe.total.outcomes).toEqual([]);
    r.assignments=[];const unassigned=designerPerformance(r);expect(unassigned.total.outcomes).toHaveLength(2);
    expect(unassigned.rows.find(row=>row.staffId==='unassigned')!.outcomes).toHaveLength(2);expect(unassigned.rows.find(row=>row.staffId==='joe')!.outcomes).toEqual([]);
  });
  it('retains an assigned undated project in designer details, excluding service history and unproven attendance from conversion',()=>{
    const r=designerFixture();const v=r.visits[5];r.assignments.push({projectId:v.projectId!,designerKey:'jordan',revision:1,updatedAt:r.asOf,basis:'Synthetic confirmation'});
    const m=designerPerformance(r,null,'jordan');expect(m.total.assignedVisits.map(v=>v.id)).toContain(v.id);expect(m.total.outcomes.some(o=>o.visit.id===v.id)).toBe(false);
    r.visits[0].status=null;expect(designerPerformance(r).total.outcomes).toHaveLength(1);
    r.visits[0].status='attended';r.visits[0].kind='excluded';const excluded=designerPerformance(r);expect(excluded.total.attended.map(v=>v.id)).not.toContain(r.visits[0].id);expect(excluded.total.outcomes).toHaveLength(1);
  });
  it('deduplicates team projects and scopes while showing joint participation and repeat workload',()=>{
    const r=designerFixture(),m=designerPerformance(r);
    expect(m.total.outcomes).toHaveLength(2);expect(m.total.attended).toHaveLength(4);
    expect(m.total.outcomes.flatMap(o=>o.paid)).toHaveLength(1);
    expect(m.rows.find(x=>x.staffId==='jordan')!.outcomes).toHaveLength(1);
    expect(m.rows.find(x=>x.staffId==='jp')!.outcomes).toHaveLength(1);
    expect(m.rows.find(x=>x.staffId==='joe')!.outcomes).toHaveLength(0);
    expect(m.coverage.some(c=>c.reasons.includes('date'))).toBe(true);
  });
  it('keeps activity and all-date undated originals when no conversion cohort exists',()=>{
    const m=designerPerformance(designerFixture('incomplete'));expect(m.total.outcomes).toEqual([]);expect(m.total.attended.length).toBeGreaterThan(0);
    expect(m.coverage.some(c=>!c.visit.day&&c.visit.purpose==='initial')).toBe(true);
    expect(m.total.unrecorded.length).toBeGreaterThan(0);
  });
  it('never moves original credit to a later repeat visit in the selected period',()=>{
    const r=designerFixture();r.start='2026-09-19';const m=designerPerformance(r);expect(m.total.attended).toHaveLength(1);expect(m.total.outcomes).toEqual([]);
  });
  it('excludes conflicting originals and known payment evidence without an ordered date',()=>{
    let r=designerFixture('conflict');let m=designerPerformance(r);expect(m.total.outcomes).toHaveLength(1);expect(m.coverage.some(c=>c.reasons.includes('originals'))).toBe(true);
    r=designerFixture();r.scopes[0].paidAt=null;m=designerPerformance(r);expect(m.total.outcomes).toHaveLength(1);expect(m.coverage.some(c=>c.reasons.includes('chronology'))).toBe(true);
  });
  it('requires strictly later days for date-only visits and prevents future outcome/attendance',()=>{
    const r=designerFixture(),v={...r.visits[0],at:null};expect(afterVisit('2026-09-04T00:30:00Z',v,r.asOf)).toBe(false);expect(afterVisit('2026-09-05T00:00:00Z',v,r.asOf)).toBe(true);
    expect(afterVisit('2026-09-04T00:30:00Z',r.visits[0],r.asOf)).toBe(true);
    r.visits[0].day='2026-09-30';r.visits[0].at='2026-09-30T00:00:00Z';r.end='2026-09-30';expect(designerPerformance(r).total.attended.find(x=>x.id===r.visits[0].id)).toBeUndefined();
  });
  it('does not attribute generic, unknown-person, withdrawn, duplicate or changed source originals',()=>{
    for(const patch of [{purpose:'site_visit' as const},{unmappedStaff:1},{withdrawn:true},{duplicate:true},{changed:true},{questions:1}]){
      const r=designerFixture();Object.assign(r.visits[0],patch);expect(designerPerformance(r).total.outcomes.find(o=>o.visit.id===r.visits[0].id)).toBeUndefined();
    }
  });
  it('uses designer selection independently of project filters and rejects duplicate DTOs',()=>{
    const r=designerFixture();expect(designerPerformance(r,null,'joe').total.outcomes).toEqual([]);
    expect(designerPerformance(r,new Set([r.visits[0].projectId!]),'jp').total.outcomes).toHaveLength(0);
    expect(designerReportSchema.safeParse({...r,visits:[r.visits[0],r.visits[0]]}).success).toBe(false);
  });
  it('omits unknown first-send timing rather than synthesizing days from a later revision',()=>{
    const r=designerFixture();r.scopes[0].undatedSend=true;const m=designerPerformance(r);expect(m.total.outcomes[0].quoteDays).toBeNull();expect(median([null,2,6])).toBe(4);expect(median([])).toBeNull();
  });
});
