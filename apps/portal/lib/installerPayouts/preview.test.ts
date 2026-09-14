import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve:vi.fn(), build:vi.fn(), calculate:vi.fn() }));
vi.mock('@/lib/costing/configurationResolver',()=>({resolvePublishedCostingConfiguration:mocks.resolve}));
vi.mock('@/lib/estimates/costingPayload',()=>({buildSiteInputsFromCalculatorInputs:mocks.build}));
vi.mock('@/lib/types/calculator',()=>({isCalculatorInputsV2:()=>true,isLegacyCalculatorInputsV1:()=>false}));
vi.mock('@sp/costing',()=>({calculateInstallerPayoutV1:mocks.calculate}));
import { previewPayout } from './preview';
const body = {scopeMatched:true,gstRegistered:true,installer:'Crew',scope:'Installation',exclusions:'None',paymentTerms:'On completion',acceptanceReference:'Email',evidenceReference:'Old schedule',benchmarkExGst:100};
const chain = {select:()=>chain,eq:()=>chain,single:async()=>({data:{source_estimate_version_id:'estimate',inputs:{}},error:null})};
const db = {rpc:vi.fn(),from:()=>chain};
beforeEach(()=>{
  db.rpc.mockResolvedValue({data:[{quote_version_id:'quote'}],error:null});
  mocks.resolve.mockResolvedValue({config:{},provenance:{source:'published',versionId:'v11'}});
  mocks.build.mockReturnValue({pergolas:[]});
  mocks.calculate.mockReturnValue({proposal:{payoutExGst:100,gst:15,totalPayable:115}});
});
it('requires matched scope and a unique accepted quote',async()=>{
  await expect(previewPayout(db as never,'project',{...body,scopeMatched:false})).rejects.toThrow('same');
  db.rpc.mockResolvedValue({data:[]}); await expect(previewPayout(db as never,'project',body)).rejects.toThrow('accepted');
  db.rpc.mockResolvedValue({data:[{},{}]}); await expect(previewPayout(db as never,'project',body)).rejects.toThrow('Multiple');
});
it('refuses repository-default fallback rates',async()=>{
  mocks.resolve.mockResolvedValue({config:{},provenance:{source:'legacy-overrides'}});
  await expect(previewPayout(db as never,'project',body)).rejects.toThrow('published pricebook');
});
it('freezes canonical scope and changes fingerprint with terms or published version',async()=>{
  const initial = await previewPayout(db as never,'project',body);
  expect(initial.agreement.sourceEstimateId).toBe('estimate');
  expect((await previewPayout(db as never,'project',{...body,paymentTerms:'Seven days'})).fingerprint).not.toBe(initial.fingerprint);
  mocks.resolve.mockResolvedValue({config:{},provenance:{source:'published',versionId:'v12'}});
  expect((await previewPayout(db as never,'project',body)).fingerprint).not.toBe(initial.fingerprint);
});
