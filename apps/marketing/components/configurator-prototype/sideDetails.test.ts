import {it,expect} from 'vitest';
import {buildRepresentativeBlind,buildRepresentativeSidePanel} from '@sp/geometry';
import {solvePergolaPreview} from './solvePreview';
import {previewBlindOpenings} from './blindSelection';
import {sidePanelSupports} from './sidePanelLayout';
import {defaultSidePanel} from './sidePanelCatalog';
import {INITIAL_INPUT} from './model';
import {INITIAL_ROOF} from './GableChoices';
it('matches the pitched ledger section to the rafters',()=>{
  const a=solvePergolaPreview(INITIAL_INPUT,INITIAL_ROOF).geometry!.assembly;
  expect(a.members.find(m=>m.role==='ledger')!.profile).toEqual(a.members.find(m=>m.role==='rafter')!.profile);
});
it('aligns pitched headers to the end rafters and closes the house-side strut with or without infill',()=>{
  const a=solvePergolaPreview(INITIAL_INPUT,INITIAL_ROOF).geometry!.assembly;
  const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF).find(o=>o.side==='left')!;
  const r=a.members.filter(m=>m.role==='rafter').sort((a,b)=>a.centerline.start.x-b.centerline.start.x)[0];
  expect(o.start.x-(o.headerOffset??0)-25).toBeCloseTo(r.centerline.start.x-r.profile.widthMm/2);
  for(const infill of [true,false]){
    const parts=buildRepresentativeBlind(o,{cover:'NONE',lowered:100,infill});
    const pts=parts[0].positions;let strutTop=false;
    for(let i=0;i<pts.length;i+=3)if(pts[i+1]<=o.start.y&&Math.abs(pts[i+2]-o.roofLine[0].z)<.01)strutTop=true;
    expect(strutTop).toBe(true);expect(parts.some(p=>p.kind==='infill')).toBe(infill);
  }
});
it('uses 3mm plates behind vertical timber and retains 50mm boxes for aluminium',()=>{
  const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0];
  for(const kind of ['timber','aluminium'] as const){
    const p={...defaultSidePanel(o.id,kind),direction:'vertical' as const};
    const frame=buildRepresentativeSidePanel(o,p,sidePanelSupports(o,p))[0];
    expect(Math.min(...frame.positions.filter((_,i)=>i%3===1))).toBeCloseTo(o.start.y-(kind==='timber'?25:75));
  }
});
it('provides a 50mm sloping angle leg behind shortened horizontal timber ends',()=>{
  const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF).find(o=>o.side==='left')!,p=defaultSidePanel(o.id,'timber');
  const frame=buildRepresentativeSidePanel(o,p,sidePanelSupports(o,p))[0];
  expect(frame.positions.filter((_,i)=>i%3===2)).toContain(o.roofLine[0].z-50);
});
