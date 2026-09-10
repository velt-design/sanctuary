import {describe,it,expect} from 'vitest';
import {buildRepresentativeSidePanel} from '@sp/geometry';
import {defaultSidePanel,parseSidePanels,faceWidth} from './sidePanelCatalog';
import {sidePanelSupports} from './sidePanelLayout';
import {previewBlindOpenings} from './blindSelection';
import {INITIAL_INPUT} from './model';
import {INITIAL_ROOF} from './GableChoices';
import {parsePreviewDraft} from './previewDraft';
import {parsePreviewDesign,serializePreviewDesign} from './previewShare';
import {buildContactDesignBrief} from '../../app/contact/contactDesignBrief';
describe('fixed side panels',()=>{
  it.each(['timber','aluminium'] as const)('supports vertical %s slats and preserves their direction',kind=>{
    const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0],p={...defaultSidePanel(o.id,kind),direction:'vertical' as const};
    const supports=sidePanelSupports(o,p);
    expect(supports.at(-1)).toBe(o.top);
    expect(supports.slice(1).every((v,i)=>v-supports[i]<=(kind==='timber'?1200:600))).toBe(true);
    const meshes=buildRepresentativeSidePanel(o,p,supports);
    expect(meshes.every(m=>m.positions.every(Number.isFinite))).toBe(true);
    const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,sidePanels:[p]}})!;
    expect(parsePreviewDesign(serializePreviewDesign(draft))!.roof.sidePanels![0].direction).toBe('vertical');
    expect(buildContactDesignBrief({...draft,result:null}).description).toContain('vertical '+kind);
    expect(parseSidePanels([{...p,kind:'acrylic'}])).toBeNull();
  });
  it('preserves custom gaps and rejects invalid or overlapping sides',()=>{
    const p=defaultSidePanel('front-1of2','aluminium');
    expect(parseSidePanels([{...p,profile:'65x16',edge:true}])![0].gap).toBe(16);
    expect(parseSidePanels([{...p,profile:'65x16',edge:true,customGap:true,gap:32}])![0].gap).toBe(32);
    expect(parseSidePanels([{...p,edge:true}])).toBeNull();expect(parseSidePanels([p,p])).toBeNull();
    expect(parseSidePanels([{...p,gap:0}])).toBeNull();
    expect(faceWidth('90x39',true)).toBe(39);
  });
  for(const family of ['mono','gable','box'] as const)for(const orientation of ['away','parallel'] as const)it(`${family} ${orientation} generates supported finite sides`,()=>{
    const roof={...INITIAL_ROOF,family,orientation},input={...INITIAL_INPUT,connection:'facade' as const};
    for(const o of previewBlindOpenings(input,roof))for(const kind of ['acrylic','timber','aluminium'] as const){
      const p=defaultSidePanel(o.id,kind),supports=sidePanelSupports(o,p);
      expect(supports[0]).toBe(0);expect(supports.at(-1)).toBeCloseTo(o.width,2);
      const max=kind==='aluminium'?600:1200;
      expect(supports.slice(1).every((x,i)=>x-supports[i]<=max+.01)).toBe(true);
      const meshes=buildRepresentativeSidePanel(o,{...p,battens:kind==='acrylic'},supports);
      expect(meshes.length).toBeGreaterThan(0);expect(meshes.every(m=>m.positions.every(Number.isFinite))).toBe(true);
      expect(meshes.some(m=>m.kind==='acrylic')).toBe(kind==='acrylic');
    }
  });
  it('uses strip spacing for tall acrylic and carries selections to enquiries and links',()=>{
    const o=previewBlindOpenings(INITIAL_INPUT,INITIAL_ROOF)[0],panel={...defaultSidePanel(o.id,'acrylic'),battens:true,profile:'90x39',gap:90};
    const s=sidePanelSupports({...o,top:4000,headerDepth:0},panel);
    expect(s.length).toBeGreaterThan(2);expect(s.slice(1).every((x,i)=>x-s[i]<=640.01)).toBe(true);
    const draft=parsePreviewDraft({version:1,input:INITIAL_INPUT,roof:{...INITIAL_ROOF,sidePanels:[panel]}})!;
    expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
    const brief=buildContactDesignBrief({...draft,result:null});expect(brief.description).toContain('horizontal timber battens');expect(brief.estimate).toBeNull();
  });
});
