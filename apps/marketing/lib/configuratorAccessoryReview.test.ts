import { describe, expect, it } from 'vitest';
import { ACCESSORY_REVIEW_RATES, getDefaultInstalledSellingRates, loadCostingConfigV1, priceBlindLineItem, priceRafterLighting } from '@sp/costing';
import { pergolaLightSites, layoutRafterLights } from '@sp/geometry';
import { buildReviewSiteInputs, calculateReviewPrice } from './configuratorReviewPrice';
import { configuratorAccessoryReview } from './configuratorAccessoryReview';
import { solvePergolaPreview } from '../components/configurator-prototype/solvePreview';
import { previewBlindOpenings } from '../components/configurator-prototype/blindSelection';
import { defaultBlind } from '../components/configurator-prototype/blindCatalog';
import { defaultSidePanel } from '../components/configurator-prototype/sidePanelCatalog';
import { DEFAULT_LIGHTING } from '../components/configurator-prototype/lightingSelection';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
const draft = (family:'mono'|'gable'|'box'='mono'):PreviewDraft=>({version:1,input:{widthMm:5000,projectionMm:3000,connection:'facade',level:'ground'},roof:{family,orientation:'parallel',infills:false}});
const priced=(d:PreviewDraft)=>{const p=calculateReviewPrice(d);if(p.status!=='priced')throw new Error(p.status);return p;};
describe('owner accessory estimate',()=>{
  it('uses a supplied installed schedule for blinds and rafter lights without extra installation charges',()=>{
    const d=draft(),o=previewBlindOpenings(d.input,d.roof)[0];
    d.roof.blinds=[defaultBlind(o.id)];
    d.roof.lighting={...DEFAULT_LIGHTING,rafterAmount:'medium'};
    const config=loadCostingConfigV1(),site=buildReviewSiteInputs(d);
    const before=configuratorAccessoryReview(d,site,config);
    config.installedSellingRates=getDefaultInstalledSellingRates();
    config.installedSellingRates.blinds.ziptrakBaseExGst=config.installedSellingRates.blinds.ziptrakBaseExGst.map(row=>row.map(rate=>rate*2));
    config.installedSellingRates.rafterLighting.lightIncCents=10000;
    const after=configuratorAccessoryReview(d,site,config);
    const amount=(result:typeof before,label:string)=>result.lines.find(line=>line.label.includes(label))!.amount;
    expect(amount(after,'Ziptrak')).toBeGreaterThan(amount(before,'Ziptrak'));
    expect(amount(after,'Rafter lighting')).toBeLessThan(amount(before,'Rafter lighting'));
    expect(after.lines.some(line=>/installation|Lighting connection/.test(line.label))).toBe(false);
    expect(after.excluded).toEqual([]);
  });
  it('uses the supplied pricebook accessory rates without changing unrelated allowances',()=>{
    const d=draft();
    d.roof.finish={material:'solid',layout:'central',acrylicBays:2,profile:'corrugated',trayWidth:400,ceiling:'thermopine-150'};
    d.roof.lighting={...DEFAULT_LIGHTING,cedarPerSection:2,cedarCount:2};
    const site=buildReviewSiteInputs(d),config=loadCostingConfigV1();
    const before=configuratorAccessoryReview(d,site,config);
    config.accessoryRates={...structuredClone(ACCESSORY_REVIEW_RATES),cedarLightSupplyAndFitEach:280};
    const after=configuratorAccessoryReview(d,site,config);
    const ceiling=(result:typeof before)=>result.lines.find(line=>line.label.startsWith('Ceiling downlights'))!;
    expect(ceiling(before).amount).toBeGreaterThan(0);
    expect(Math.abs(ceiling(after).amount-2*ceiling(before).amount)).toBeLessThanOrEqual(1);
    expect(after.lines.filter(line=>!line.label.startsWith('Ceiling downlights'))).toEqual(before.lines.filter(line=>!line.label.startsWith('Ceiling downlights')));
    expect(after.excluded).toEqual([]);
    expect(ACCESSORY_REVIEW_RATES.cedarLightSupplyAndFitEach).toBe(140);
  });
  it('uses full blind drop regardless of how far the blind is lowered; no double markup',()=>{
    const d=draft(), o=previewBlindOpenings(d.input,d.roof)[0];
    d.roof.blinds=[{...defaultBlind(o.id),cover:'NONE',lowered:20}];
    const p=priced(d),line=p.breakdown!.find(l=>l.label.includes('Ziptrak'))!;
    const expected=priceBlindLineItem({id:o.id,system:'ZIPTRAK',widthMm:o.width,coverLengthMm:o.top,fabric:'MESH',motorised:false,rollCover:'NONE'});
    expect(line.amount).toBe(Math.round(expected.blindSellIncCents/100));
    expect(p.breakdown!.some(l=>l.label.includes('blind installation'))).toBe(false);
    expect(p.amount-priced(draft()).amount).toBe(line.amount);
    expect(line.detail).toContain('including installation');
    d.roof.blinds[0].lowered=100;expect(priced(d).amount).toBe(p.amount);
    expect(p.amount).toBe(p.breakdown!.reduce((sum,l)=>sum+l.amount,0));
  });
  it.each(['mono','gable','box'] as const)('prices fixed sides and roof battens on %s',family=>{
    const d=draft(family),o=previewBlindOpenings(d.input,d.roof)[0],base=priced(d).amount;
    for(const kind of ['acrylic','timber','aluminium'] as const){
      d.roof.sidePanels=[defaultSidePanel(o.id,kind)];
      const p=priced(d);expect(p.amount).toBeGreaterThan(base);expect(p.excluded).toEqual([]);
    }
    d.roof.sidePanels=[];d.roof.roofBattens={profile:'65x39',edge:false,gap:65,customGap:false};
    expect(priced(d).breakdown).toEqual(expect.arrayContaining([expect.objectContaining({label:'Roof timber battens',provisional:true})]));
  });
  it('changes slat price with spacing and preserves the acrylic base when adding timber',()=>{
    const d=draft(),o=previewBlindOpenings(d.input,d.roof)[0],panel=defaultSidePanel(o.id,'acrylic');d.roof.sidePanels=[panel];
    const plain=priced(d);panel.battens=true;const dense=priced(d);panel.gap=150;panel.customGap=true;const sparse=priced(d);
    expect(sparse.amount).toBeGreaterThan(plain.amount);expect(dense.amount).toBeGreaterThan(sparse.amount);
    expect(dense.breakdown!.find(l=>l.label==='Acrylic panels & infills')).toEqual(plain.breakdown!.find(l=>l.label==='Acrylic panels & infills'));
  });
  it('counts placed rafter lights, not stale counts, and uses the portal lighting price',()=>{
    const d=draft('gable');d.roof.lighting={...DEFAULT_LIGHTING,rafterAmount:'medium',rafterCount:99};
    const g=solvePergolaPreview(d.input,d.roof).geometry!,sites=pergolaLightSites(g.assembly,g.covering),count=layoutRafterLights(sites.rafters,'medium').length;
    const p=priced(d),expected=priceRafterLighting({pergolaId:'preview',lightCount:count,dimmer:false,acrylicEligible:true});
    expect(p.breakdown!.find(l=>l.label.startsWith('Rafter lighting'))?.amount).toBe(Math.round(expected.lightingSellIncCents/100));
    expect(p.amount-priced(draft('gable')).amount).toBe(Math.round(expected.lightingSellIncCents/100));
    expect(p.breakdown!.some(l=>l.label==='Lighting connection')).toBe(false);
  });
  it('charges one connection for cedar and strips together, and only real selected strips',()=>{
    const d=draft();d.roof.finish={material:'solid',layout:'central',acrylicBays:2,profile:'corrugated',trayWidth:400,ceiling:'thermopine-150'};
    const g=solvePergolaPreview(d.input,d.roof).geometry!,sites=pergolaLightSites(g.assembly,g.covering);
    d.roof.lighting={...DEFAULT_LIGHTING,cedarPerSection:2,cedarCount:2,strips:sites.strips.slice(0,2).map(s=>s.id)};
    const p=priced(d);expect(p.breakdown!.filter(l=>l.label==='Lighting connection')).toHaveLength(1);
    expect(p.breakdown!.some(l=>l.label.startsWith('Ceiling downlights'))).toBe(true);
    d.roof.lighting.strips.push('unknown');expect(priced(d).amount).toBe(p.amount);
  });
  it('flags specialty fabric and missing openings rather than silently including them',()=>{
    const d=draft(),o=previewBlindOpenings(d.input,d.roof)[0];d.roof.blinds=[{...defaultBlind(o.id),fabric:'horizon'}];
    expect(priced(d).excluded.join(' ')).toContain('specialty fabric');
    d.roof.blinds=[defaultBlind('front-9of9')];expect(priced(d).excluded.join(' ')).toContain('opening unavailable');
  });
});
