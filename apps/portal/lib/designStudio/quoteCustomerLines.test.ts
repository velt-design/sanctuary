import {expect,it} from 'vitest';
import {studioCustomerQuoteLines} from './quoteCustomerLines';
it('describes customer scope without changing approved amounts or allowance exclusions',()=>{
 const lines=studioCustomerQuoteLines([
  {label:'Pergolas, roofs & ceilings',amount:24451.85,provisional:false,detail:'Full independent product scope, shared job operations once and protected installation. No shared-member savings.'},
  {label:'Lighting connection',amount:200,provisional:true,detail:'Existing suitable supply assumed; new circuits excluded.'},
 ],2);
 expect(lines[0].description).toContain('2 pergolas');
 expect(lines[0].description).not.toMatch(/shared|policy|pricebook|protected/i);
 expect(lines.map(l=>l.lineTotalIncGstCents)).toEqual([2445185,20000]);
 expect(lines[1].description).toContain('(allowance)\n- Existing suitable supply assumed; new circuits excluded.');
});
it('uses concrete accessory scope and retains exclusions without internal rates or solver wording',()=>{
 const descriptions=[
  ['Pergola 2 · Rafter lighting · 12 lights','Portal price including installation, startup and required drivers. Only exposed eligible rafters are counted.'],
  ['Pergola 2 · Ceiling downlights · 2 lights','Pricebook supply and fit allowance per 110 mm downlight, before selling multiplier.'],
  ['Pergola 2 · LED strips · 3 m','Provisional $65/m ex-GST strip, 16 × 16 channel and fitting; $100 driver allowance per member, before selling multiplier.'],
  ['Pergola 2 · Ziptrak','Portal manual-blind price including installation and selected roll cover. Fabric-group mapping and pelmet kit scope remain provisional; no motor included.'],
  ['Lighting connection','Existing suitable supply assumed; new circuits and difficult cable routes excluded.'],
 ];
 const lines=studioCustomerQuoteLines(descriptions.map(([label,detail])=>({label,detail,amount:123,provisional:true})),0);
 expect(lines.map(l=>l.description).join(' ')).not.toMatch(/Portal|Pricebook|multiplier|eligible|\$65|\$100/);
 expect(lines[0].description).toContain('12 lights');expect(lines[0].description).toContain('startup and required drivers');expect(lines[3].description).toContain('no motor included');
 expect(lines[4].description).toContain('new circuits and difficult cable routes excluded');expect(lines.every(l=>l.lineTotalIncGstCents===12300)).toBe(true);
});
it('does not claim every standalone category when only one additional item was purchased',()=>{
 const lines=studioCustomerQuoteLines([{label:'Additional site scope',amount:219.01,provisional:false,detail:'Selected standalone infills, aluminium and site allowances.'}],0,[{label:'Standalone aluminium · RHS 150 x 50',details:['Black aluminium','2 full 6.5 m bars']}]);
 expect(lines[0].description).toBe('Additional site scope\n- Standalone aluminium · RHS 150 x 50: Black aluminium; 2 full 6.5 m bars');
 expect(lines[0].description).not.toMatch(/infill|blind|rate|multiplier/i);
 expect(lines[0]).toMatchObject({qty:1,unitPriceIncGstCents:21901,lineTotalIncGstCents:21901,sortOrder:0});
});
it('describes validated infills and aluminium once in their charged group without duplicating separately priced blinds or changing other lines',()=>{
 const breakdown=[{label:'Pergolas, roofs & ceilings',amount:1000,provisional:false,detail:'Protected internal pricing.'},{label:'Additional site scope',amount:345.67,provisional:false,detail:'Selected standalone infills, aluminium and site allowances.'},{label:'Standalone blind · Ziptrak',amount:900,provisional:true,detail:'Manual blinds including installation; no motor included.'}];
 const scope=[{label:'Standalone infill · Side',details:['2 openings · Side','Rectangle · width 1200 mm × height 1800 mm','White aluminium','Acrylic panels · vertical orientation']},{label:'Standalone aluminium · 80 x 50',details:['Mill aluminium, powdercoat: Grey','1 full 6 m bar']},{label:'Standalone blind · Screen',details:['Ziptrak · 3000 × 2400 mm','Mesh · Manual · Pelmet']}];
 const before=studioCustomerQuoteLines(breakdown,1),after=studioCustomerQuoteLines(breakdown,1,scope);
 expect(after[0]).toEqual(before[0]);expect(after[2]).toEqual(before[2]);
 expect(after.map(({description,...price})=>price)).toEqual(before.map(({description,...price})=>price));
 expect(after[1].description).toContain('2 openings · Side; Rectangle · width 1200 mm × height 1800 mm; White aluminium; Acrylic panels · vertical orientation');
 expect(after[1].description).toContain('1 full 6 m bar');expect(after[1].description).not.toContain('Ziptrak');
 const infillOnly=studioCustomerQuoteLines([breakdown[1]],0,[scope[0]])[0];
 expect(infillOnly.description).toContain('1200 mm');expect(infillOnly.description).not.toContain('Standalone aluminium');
});
