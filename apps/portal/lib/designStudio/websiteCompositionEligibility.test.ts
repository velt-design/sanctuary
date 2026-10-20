import {it,expect,vi} from 'vitest';
import {solvePergolaPreview} from '@sp/configurator/geometry';
vi.mock('@sp/configurator/geometry',async original=>{const actual=await original<typeof import('@sp/configurator/geometry')>();return {...actual,solvePergolaPreview:vi.fn(actual.solvePergolaPreview)};});
import {websiteCompositionPriceEligibility} from './websiteCompositionEligibility';
import {newStudioWebsiteDesign} from './websiteDesign';
import {websiteComposition} from './websiteComposition';
function rows(x:string,rotation='0'){
 const p=(id:string,x:string)=>({id,label:id,family:'mono' as const,attachmentEdgeId:null,attachmentZoneId:null,side:'rear' as const,strategy:null,position:{originXMm:x,originYMm:'0',rotationDeg:rotation}});
 return websiteComposition({spatial:{houseAssembly:null,decks:[],openings:[],pergolas:[p('Pergola A','0'),p('Pergola B',x)]},objectOptions:['Pergola A','Pergola B'].map(objectId=>({objectId,values:{websiteDesign:newStudioWebsiteDesign(objectId) as never}}))});
}
it('allows separated real geometry and rejects named conservative contact without certifying collision',()=>{
 expect(websiteCompositionPriceEligibility(rows('9000'))).toBeNull();
 expect(websiteCompositionPriceEligibility(rows('6000'))).toContain('Pergola A and Pergola B');
 expect(websiteCompositionPriceEligibility(rows('0','90'))).toContain('Cannot price this arrangement yet');
});
it('does not substitute an origin for invalid placement',()=>expect(websiteCompositionPriceEligibility(rows('bad'))).toContain('Enter valid position'));
it('includes a covering mesh protruding beyond structural members in arrangement eligibility',()=>{
 const solve=vi.mocked(solvePergolaPreview),original=solve.getMockImplementation()!;
 solve.mockImplementationOnce((input,roof)=>{const result=original(input,roof);result.geometry!.covering={meshes:[{id:'protruding-roof',kind:'steel',positions:[10000,0,2500,10000,1000,2500,6000,1000,2500],indices:[0,1,2]}],regions:[],acrylicBays:0,maxAcrylicBays:1};return result;});
 expect(websiteCompositionPriceEligibility(rows('9000'))).toContain('Pergola A and Pergola B');
});
