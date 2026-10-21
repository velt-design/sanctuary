import {expect,it} from 'vitest';
import {loadCostingConfigV1,ACCESSORY_REVIEW_RATES,priceAllBlinds,getDefaultInstalledSellingRates} from '@sp/costing';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '../drawings/state/objectFirstWorkbenchModel';
import {addWebsitePergola} from './websiteComposition';
import {calculateStudioCommercialPricing} from './studioCommercialPricing.server';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
const config={...loadCostingConfigV1(),accessoryRates:structuredClone(ACCESSORY_REVIEW_RATES),installedSellingRates:getDefaultInstalledSellingRates()};
it('prices additional stock, infills and standalone blinds through the same retained Review source',()=>{
 const start:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'additional-scope-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const edit=addWebsitePergola(start,'first');
 const baseline=calculateStudioCommercialPricing(edit,config).amount;
 edit.site={access:'normal',height:'single_storey',additionalAluminium:{extrusionColour:'Black',rows:[{id:'stock',profile:'200x50',stockLengthM:'6',quantity:'2'}]},
 standaloneInfills:{extrusionColour:'Black',items:[{id:'infill',label:'Side opening',qty:'1',location:'custom',acrylicSource:'auto',panelOrientation:'auto',shape:{type:'rect',widthM:'1.2',heightM:'0.6',bottomOffsetM:'0'},support:{edgeConfirmations:{top:'yes',bottom:'yes',left:'yes',right:'yes'},internalSupportMode:'center',internalSupportPositionsM:[]}}]},
 blinds:{items:[{id:'blind',label:'Separate blind',system:'ZIPTRAK',widthMm:'2000',coverLengthMm:'2000',fabric:'MESH',motorised:'NONE',rollCover:'NONE'}]}};
 const restored=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(edit)));
 if(!restored.ok)throw Error(restored.message);
 const priced=calculateStudioCommercialPricing(restored.value,config);
 expect(priced.amount).toBeGreaterThan(baseline);
 expect(priced.siteInputs.additional_aluminium?.rows).toEqual([{id:'stock',profile:'200x50',stock_length_m:6,quantity:2}]);
 expect(priced.siteInputs.standalone_infills?.infills[0].acrylic_source).not.toBe('auto');
 expect(priced.breakdown.filter(line=>line.label==='Additional site scope')).toHaveLength(1);
 const blind=priceAllBlinds([{id:'blind',label:'Separate blind',system:'ZIPTRAK',widthMm:2000,coverLengthMm:2000,fabric:'MESH',motorised:false,rollCover:'NONE'}],config.installedSellingRates!.blinds).items[0];
 expect(priced.breakdown.find(line=>line.label==='Separate blind')?.amount).toBe(blind.blindSellIncCents/100);
 expect(calculateStudioCommercialPricing(edit,config).amount).toBe(priced.amount);
 expect(priced.customerStandaloneSelections).toContainEqual({label:'Standalone aluminium · 200x50',details:['Black aluminium','2 full 6 m bars']});
 expect(priced.customerStandaloneSelections.find(row=>row.label==='Standalone infill · Side opening')?.details).toContain('Rectangle · width 1200 mm × height 600 mm');
 expect(priced.customerStandaloneSelections).toContainEqual({label:'Standalone blind · Separate blind',details:['Ziptrak · 2000 × 2000 mm','Mesh · Manual · No roll cover']});
 expect(JSON.stringify(priced.customerStandaloneSelections)).not.toMatch(/cost_ex|markup|multiplier|supplier|pricebook/i);
});
