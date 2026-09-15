import { expect, it } from 'vitest';
import { pergolaLightSites, type StripSite } from '@sp/geometry';
import { loadCostingConfigV1 } from '@sp/costing';
import { INITIAL_INPUT } from './model';
import { INITIAL_ROOF } from './GableChoices';
import { solvePergolaPreview, solveSimpleCoverSurroundings } from './solvePreview';
import { perimeterLedPreset } from './perimeterLedPreset';
import { parsePreviewDraft } from './previewDraft';
import { serializePreviewDesign, parsePreviewDesign } from './previewShare';
import { defaultSidePanel, parseSidePanels } from './sidePanelCatalog';
import { buildContactDesignBrief } from '../../app/contact/contactDesignBrief';
import { calculateConfiguratorPricing } from '../../lib/configuratorReviewPrice';

it.each(['mono','gable','box'] as const)('retains freestanding %s geometry, price and enquiry intent through sharing', family => {
  for (const orientation of ['parallel','away'] as const) for (const material of ['acrylic','solid','combination'] as const) {
    const draft = parsePreviewDraft({version:1,input:{...INITIAL_INPUT,widthMm:5000},roof:{...INITIAL_ROOF,family,orientation,attachmentIntent:'freestanding',
      finish:{material,layout:'central',profile:'corrugated',acrylicBays:2,trayWidth:400}}})!;
    expect(draft).not.toBeNull();
    const geometry = solvePergolaPreview(draft.input,draft.roof).geometry!;
    expect(geometry).toBeTruthy();
    expect(geometry.assembly.semantics.connectionType).toBe('freestanding');
    expect(geometry.assembly.attachmentEdge).toBeNull();
    expect(geometry.assembly.members.filter(m=>m.role==='post').length).toBeGreaterThanOrEqual(4);
    expect(geometry.assembly.members.some(m=>m.role==='ledger')).toBe(false);
    expect(solveSimpleCoverSurroundings(draft.input,geometry.assembly,draft.roof)).toBeNull();
    expect(parsePreviewDesign(serializePreviewDesign(draft))).toEqual(draft);
    expect(buildContactDesignBrief({...draft,result:null}).description).toContain('Freestanding');
    const priced = calculateConfiguratorPricing(draft,loadCostingConfigV1());
    expect(priced.estimate.status).toBe('priced');
    expect(priced.siteInputs!.pergolas[0].modules[0].post_count).toBe(geometry.assembly.members.filter(m=>m.role==='post').length);
    expect(priced.siteInputs!.pergolas[0].modules[0].house_connection_type).toBe('none');
  }
});

it.each(['mono','gable','box'] as const)('compares available %s attachments and retains uncertainty',family=>{
  for(const projectionMm of [3000,4100]) {
    const draft=parsePreviewDraft({version:1,input:{...INITIAL_INPUT,widthMm:5000,projectionMm},roof:{...INITIAL_ROOF,family,attachmentIntent:'unsure'}})!;
    const config=loadCostingConfigV1();
    const actual=calculateConfiguratorPricing(draft,config);
    const options=(['facade','fascia','soffit'] as const).filter(c=>!(family==='box'&&c==='fascia')&&!(projectionMm>4000&&c==='soffit'));
    const prices=options.map(connection=>calculateConfiguratorPricing({...draft,input:{...draft.input,connection},roof:{...draft.roof,attachmentIntent:undefined}},config).estimate);
    expect(actual.estimate.status).toBe('priced');
    if(actual.estimate.status==='priced')expect(actual.estimate.amount).toBe(Math.min(...prices.map(p=>p.status==='priced'?p.amount:Infinity)));
    expect(parsePreviewDesign(serializePreviewDesign(draft))!.roof.attachmentIntent).toBe('unsure');
    expect(buildContactDesignBrief({...draft,result:null}).description).toContain('not sure');
  }
});

it('starts new screens vertical, largest profile, on edge and 100mm without changing older choices',()=>{
  for(const kind of ['timber','aluminium'] as const) {
    const panel=defaultSidePanel('front-1of2',kind);
    expect(parseSidePanels([panel])![0]).toMatchObject({direction:'vertical',edge:true,gap:100,profile:kind==='timber'?'90x39':'65x16'});
    const old={...panel,direction:undefined,edge:false,gap:65,customGap:false,profile:'65x39',kind:'timber'};
    expect(parseSidePanels([old])![0]).toMatchObject({edge:false,gap:65});
    expect(parseSidePanels([old])![0].direction).toBeUndefined();
  }
});

it('keeps one perimeter strip on doubled/tripled beams and keeps split gable edges',()=>{
  const site=(id:string,x:number,y1:number,y2:number):StripSite=>({id,label:id,start:{x,y:y1,z:2400},end:{x,y:y2,z:2400},normal:{x:0,y:0,z:1},perimeter:true,rafter:true});
  const sites=[site('outer-a',25,0,1500),site('outer-b',25,1500,3000),site('inner',75,0,3000),site('third',110,0,3000),site('right',5000,0,3000)];
  expect(perimeterLedPreset(sites).sort()).toEqual(['outer-a','outer-b','right']);
});

it.each(['mono','gable','box'] as const)('uses only available %s mounting sites for perimeter preset',family=>{
  const geometry=solvePergolaPreview(INITIAL_INPUT,{...INITIAL_ROOF,family}).geometry!;
  const sites=pergolaLightSites(geometry.assembly,geometry.covering).strips;
  const preset=perimeterLedPreset(sites);
  expect(preset.length).toBeGreaterThan(0);
  expect(preset.every(id=>sites.some(s=>s.id===id&&s.perimeter))).toBe(true);
  expect(new Set(preset).size).toBe(preset.length);
});
