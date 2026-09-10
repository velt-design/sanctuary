import { describe,it,expect } from 'vitest';
import { blindHeaderDepth, buildRepresentativeBlind, fitRepresentativeBlindPosts } from '@sp/geometry';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';
import { previewBlindOpenings,blindUnavailable } from './blindSelection';
import { defaultBlind,parseBlinds } from './blindCatalog';
import { parsePreviewDraft } from './previewDraft';
import { serializePreviewDesign,parsePreviewDesign } from './previewShare';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';
import { solvePergolaPreview } from './solvePreview';

describe('marketing Ziptrak blinds',()=>{
  it('joins uncovered fabric to the roll and recesses flashing 5mm',()=>{
    const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0];
    for(const lowered of [25,100]) {
      const fabric=buildRepresentativeBlind(o,{cover:'NONE',lowered,infill:false}).find(m=>m.kind==='fabric')!;
      expect(Math.max(...fabric.positions.filter((_,i)=>i%3===2))).toBe(o.top-65-(lowered===100?34:50));
    }
    const frame=buildRepresentativeBlind(o,{cover:'FLASHING',lowered:100,infill:false})[0];
    const posts=solvePergolaPreview(INITIAL_INPUT,INITIAL_ROOF).geometry!.assembly.members.filter(m=>m.role==='post');
    const face=Math.max(...posts.map(p=>p.centerline.start.y+p.profile.depthMm/2));
    expect(Math.max(...frame.positions.filter((_,i)=>i%3===1))).toBe(face-5);
  });
  it.each(['mono','gable','box'] as const)('fits adjoining %s pelmets with 150mm posts and aligned exterior faces',family=>{
    const input={...INITIAL_INPUT,widthMm:3900,projectionMm:3000,connection:'facade' as const};
    const roof={...INITIAL_ROOF,family,orientation:'away' as const};
    const bare=solvePergolaPreview(input,roof).geometry!.assembly;
    const blinds=previewBlindOpenings(input,roof).map(o=>defaultBlind(o.id));
    const fitted=solvePergolaPreview(input,{...roof,blinds}).geometry!.assembly;
    const posts=fitted.members.filter(m=>m.role==='post' && m.profile.widthMm===m.profile.depthMm);
    expect(fitRepresentativeBlindPosts(fitted,blinds)).toBeNull();
    expect(posts.every(p=>p.profile.widthMm===150)).toBe(true);
    for(const p of posts) {
      expect(p.centerline.start.x-75).toBeGreaterThanOrEqual(-.01);
      expect(p.centerline.start.x+75).toBeLessThanOrEqual(input.widthMm+.01);
      expect(p.centerline.start.y+75).toBeLessThanOrEqual(input.projectionMm+.01);
      const original=bare.members.find(m=>m.id===p.id)!;
      expect(p.centerline.start.y+75).toBeCloseTo(original.centerline.start.y+original.profile.widthMm/2);
    }
    const one=solvePergolaPreview(input,{...roof,blinds:blinds.slice(0,1)}).geometry!.assembly;
    expect(one.members.filter(m=>m.role==='post').map(m=>m.profile)).toEqual(bare.members.filter(m=>m.role==='post').map(m=>m.profile));
    expect(previewBlindOpenings(input,{...roof,blinds}).map(o=>o.id)).toEqual(blinds.map(b=>b.opening));
  });
  it.each([[2000,50],[2001,100],[4000,100],[4001,150],[6000,150]])('sizes a %imm header at %imm depth',(span,depth)=>expect(blindHeaderDepth(span)).toBe(depth));
  for(const family of ['mono','gable','box'] as const) for(const orientation of ['parallel','away'] as const) it(family+' '+orientation+' follows openings and builds finite hardware',()=>{
    const input={...INITIAL_INPUT,connection:'facade' as const},roof={...INITIAL_ROOF,family,orientation};
    const openings=previewBlindOpenings(input,roof);
    expect(openings.length).toBeGreaterThanOrEqual(3);
    for(const o of openings) {
      expect(o.width).toBeGreaterThan(650);expect(o.top).toBeGreaterThan(1500);
      for(const cover of ['NONE','FLASHING','PELMET'] as const) for(const lowered of [0,50,100]) {
        const parts=buildRepresentativeBlind(o,{cover,lowered,infill:true});
        expect(parts.every(p=>p.positions.every(Number.isFinite))).toBe(true);
        expect(parts.some(p=>p.kind==='fabric')).toBe(lowered>0);
      }
    }
  });
  it('preserves finishes through sharing and enquiry without quoting the bare pergola price',()=>{
    const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0];
    const roof={...INITIAL_ROOF,blinds:[{...defaultBlind(o.id),fabric:'pvc',colour:'Tinted',lowered:50}]};
    const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof})!;
    expect(draft.roof.blinds).toHaveLength(1);
    expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
    const brief=buildContactDesignBrief({...draft,result:null});
    expect(brief.estimate).toBeNull();expect(brief.description).toContain('Tinted');expect(brief.description).toContain('Ziptrak');
  });
  it('enforces material-specific width limits and drops stale opening identities',()=>{
    const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0];
    expect(blindUnavailable({...o,width:5600},'pvc')).toContain('5.5');
    expect(blindUnavailable({...o,width:5600},'urban')).toBe('');
    const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,blinds:[defaultBlind('front-9of9')]}})!;
    expect(draft.roof.blinds).toEqual([]);
    expect(parseBlinds([{...defaultBlind(o.id),colour:'Injected fabric'}])).toBeNull();
    expect(parseBlinds([defaultBlind(o.id),defaultBlind(o.id)])).toBeNull();
  });
});
