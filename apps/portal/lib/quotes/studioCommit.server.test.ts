import {beforeEach, describe, expect, it, vi} from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabaseClient',()=>({supabaseServiceRole:{rpc:mocks.rpc}}));
import {commitQuoteWithStudioBinding,loadStudioQuoteView} from './studioCommit.server';
const view={schemaVersion:'studio_quote_snapshot.v1',snapshotId:'snapshot',contentHash:'hash',images:[],selections:[]};
beforeEach(()=>vi.resetAllMocks());
describe('quote snapshot commercial adapter',()=>{
 it('retains the ordinary quote RPC and delegates a bound quote with explicit operation',async()=>{
  mocks.rpc.mockResolvedValue({data:{id:'quote'},error:null});
  const ordinary={p_pricing_source_metadata:{},p_expected_commercial_revision:8};
  await commitQuoteWithStudioBinding('refresh',ordinary);
  expect(mocks.rpc).toHaveBeenLastCalledWith('commercial_quote_update_draft',ordinary);
  const bound={...ordinary,p_pricing_source_metadata:{studioSnapshotId:'snapshot',studioSnapshotHash:'hash'}};
  await commitQuoteWithStudioBinding('revise',bound);
  expect(mocks.rpc).toHaveBeenLastCalledWith('studio_website_quote_commit_address',{p_operation:'revise',p_snapshot_id:'snapshot',p_content_hash:'hash',p_command:bound});
 });
 it('finds a binding independently and rejects metadata that would hide its views',async()=>{
  mocks.rpc.mockResolvedValue({data:view,error:null});
  await expect(loadStudioQuoteView('quote',{})).rejects.toThrow(/frozen Studio design/);
  expect(mocks.rpc).toHaveBeenCalledWith('studio_website_quote_view',{p_quote_version_id:'quote'});
  await expect(loadStudioQuoteView('quote',{studioSnapshotId:'snapshot',studioSnapshotHash:'hash'})).resolves.toEqual(view);
 });
 it('keeps ordinary quotes without a binding and fails closed for a missing bound snapshot',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});
  await expect(loadStudioQuoteView('ordinary',{})).resolves.toBeUndefined();
  await expect(loadStudioQuoteView('bound',{studioSnapshotId:'snapshot'})).rejects.toThrow(/frozen Studio design/);
 });
});

it('selects the separate-document commit only from trusted copied metadata and reads only marked matching v2 views',async()=>{
 mocks.rpc.mockResolvedValue({data:{id:'quote'},error:null});const metadata={studioSnapshotId:'snapshot',studioSnapshotHash:'hash',studioDocumentMode:'separate_v1'};
 await commitQuoteWithStudioBinding('create',{p_pricing_source_metadata:metadata});expect(mocks.rpc).toHaveBeenLastCalledWith('studio_client_quote_commit',expect.objectContaining({p_snapshot_id:'snapshot',p_content_hash:'hash'}));
 mocks.rpc.mockResolvedValue({data:{...view,schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1'},error:null});await expect(loadStudioQuoteView('quote',metadata)).resolves.toMatchObject({schemaVersion:'studio_quote_snapshot.v2'});
 mocks.rpc.mockResolvedValue({data:{...view,schemaVersion:'studio_quote_snapshot.v2'},error:null});await expect(loadStudioQuoteView('quote',metadata)).rejects.toThrow(/frozen Studio design/);
});

it('retains the exact frozen presentation selector on reload and refuses an unknown layout instead of silently rendering legacy',async()=>{
 const metadata={studioSnapshotId:'snapshot',studioSnapshotHash:'hash'};
 const refined={...view,schemaVersion:'studio_quote_snapshot.v2',documentMode:'separate_v1',quotePresentationVersion:'sanctuary-quote.v3'};
 mocks.rpc.mockResolvedValue({data:refined,error:null});
 await expect(loadStudioQuoteView('quote',metadata)).resolves.toEqual(refined);
 mocks.rpc.mockResolvedValue({data:{...refined,quotePresentationVersion:'unknown'},error:null});
 await expect(loadStudioQuoteView('quote',metadata)).rejects.toThrow('frozen quote presentation');
});
