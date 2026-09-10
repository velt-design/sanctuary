import { describe,it,expect } from 'vitest';
import { blindHeaderDepth, buildRepresentativeBlind } from '@sp/geometry';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';
import { previewBlindOpenings,blindUnavailable } from './blindSelection';
import { defaultBlind,parseBlinds } from './blindCatalog';
import { parsePreviewDraft } from './previewDraft';
import { serializePreviewDesign,parsePreviewDesign } from './previewShare';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';

describe('marketing Ziptrak blinds',()=>{
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
