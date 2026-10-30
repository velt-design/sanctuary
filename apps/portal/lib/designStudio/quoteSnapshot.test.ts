import {describe, expect, it} from 'vitest';
import {prepareStudioCreation} from './createPreparation';
import {projectStudioAuthoringView} from './authoringView';
import {readStudioQuoteHandoff, type StudioQuoteHandoff} from './quoteSnapshot';
import {mapQuoteSourceEstimateRow} from '../quotes/serverLoaders';
import {buildQuoteLineItemsFromEstimate} from '../quotes/mapping';
import {buildOptimisticQuoteDetail, buildQuoteHandoffPreviewFromEstimateDetail} from '../localFirst/studioQuotePreparation';
import {buildQuoteHandoffPreviewFromEstimateDetail as calculatorPreview,buildOptimisticQuoteDetail as calculatorPrepare} from '../localFirst/quotePreparation';
import type {EstimateDetail} from '../estimates/types';
import {emptyEstimateEditability} from '../estimates/editability';
import type {QuoteVersion} from '../quotes/types';
function fixture(){
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'quote-proof',commercialScopeId:null});
 if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs;
 const view=projectStudioAuthoringView({authored:outputs.studio_authored,spatial:outputs.drawing_object_first});
 if(!view.ok)throw Error(view.message);
 const handoff:StudioQuoteHandoff={schemaVersion:'studio_quote_snapshot.v1',snapshotId:'10000000-0000-4000-8000-000000000002',contentHash:'a'.repeat(64),source:view.value,
 lines:[{description:'Configured design',qty:1,unitPriceIncGstCents:1167400,lineTotalIncGstCents:1167400,sortOrder:0}],totalIncGstCents:1167400,approvalRequirement:'neither',approvalIncGstCents:0};
 outputs.studio_quote_handoff=handoff as any;
 return outputs;
}
describe('exact Studio quote handoff',()=>{
 it('preserves scope, source and strict handoff checks through dedicated local-first quote preparation',()=>{
  const outputs=fixture();
  const detail:EstimateDetail={id:'est_1',projectId:'proj_1',versionLabel:'V4',createdAt:'2026-10-20T00:00:00Z',status:'draft',
   commercialScopeId:'scope_1',commercialScopeKind:'add_on',calculatorSnapshot:{inputs:{},outputs},summary:{total:11674},
   isActiveDraft:true,hasSentQuote:false,jobPackEligible:false,jobPackGeneratedAt:null,jobPackQuoteVersionId:null,
   editability:emptyEstimateEditability()};
  const args={quoteVersionId:'qv_local',projectId:'proj_1',estimateDetail:detail,createdAt:'2026-10-20T00:00:00Z',
   existingQuotes:[{commercialScopeId:'scope_2',versionNumber:99,quoteRef:'Q-OTHER'},
    {commercialScopeId:'scope_1',versionNumber:3,quoteRef:'Q-SCOPE'}] as QuoteVersion[]};
  expect(buildQuoteHandoffPreviewFromEstimateDetail(detail)).toMatchObject({totalIncGstCents:1167400,blockingIssues:[]});
  expect(calculatorPreview(detail)).toMatchObject({totalIncGstCents:0,lineItems:[],blockingIssues:[expect.stringContaining('Open Studio Review')]});
  expect(()=>calculatorPrepare(args)).toThrow('Open Studio Review');
  expect(buildOptimisticQuoteDetail(args)).toMatchObject({quoteRef:'Q-SCOPE',versionNumber:4,commercialScopeId:'scope_1',
   sourceEstimateVersionId:'est_1',sourceEstimateVersionLabel:'V4',totals:{totalIncGstCents:1167400}});
  (outputs.studio_authored as any).site.values.travelExGst='1';
  expect(buildQuoteHandoffPreviewFromEstimateDetail(detail).blockingIssues).not.toEqual([]);
  expect(()=>buildOptimisticQuoteDetail(args)).toThrow();
 });
 it('uses the same strict handoff after the current quote loader adds optional engine fields',()=>{
  const estimate=mapQuoteSourceEstimateRow({id:'10000000-0000-4000-8000-000000000003',project_id:'10000000-0000-4000-8000-000000000001',outputs:fixture()});
  expect(estimate.outputs.pergolas).toBeUndefined();
  expect(buildQuoteLineItemsFromEstimate(estimate)).toMatchObject({coreTotalIncCents:1167400,blockingIssues:[]});
  (estimate.outputs as any).studio_quote_handoff.totalIncGstCents++;
  expect(buildQuoteLineItemsFromEstimate(estimate).blockingIssues[0].code).toBe('STUDIO_REVIEW_REQUIRED');
 });
 it('returns a detached handoff and rejects later source changes even at the same price',()=>{
  const outputs=fixture(),handoff=readStudioQuoteHandoff(outputs);
  expect(handoff?.totalIncGstCents).toBe(1167400);
  handoff!.lines[0].description='local mutation';
  expect(readStudioQuoteHandoff(outputs)?.lines[0].description).toBe('Configured design');
  (outputs.studio_authored as any).site.values.travelExGst='1';
  expect(readStudioQuoteHandoff(outputs)).toBeNull();
 });
 it.each(['missing','mismatched-total','fractional-quantity','wrong-version'])('fails closed for %s instead of calculator fallback',kind=>{
  const outputs=fixture(),handoff=outputs.studio_quote_handoff as any;
  if(kind==='missing')delete outputs.studio_quote_handoff;
  if(kind==='mismatched-total')handoff.totalIncGstCents++;
  if(kind==='fractional-quantity')handoff.lines[0].qty=.5;
  if(kind==='wrong-version')handoff.schemaVersion='future';
  expect(readStudioQuoteHandoff(outputs)).toBeNull();
 });
});
