// @vitest-environment node
import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {loadCostingConfigV1,snapshotCostingControlConfigV1} from '@sp/costing';
import {hashCostingControlConfigV1,resolvePublishedCostingConfigurationRecordV1} from '@sp/costing/server';
import {packStudioFrozenAudit,unpackStudioFrozenAuditEvidence} from '../apps/portal/lib/costing/auditArchive.server';
import {calculateStudioCommercialPricing} from '../apps/portal/lib/designStudio/studioCommercialPricing.server';
import {studioClientDocumentFixture} from './fixtures/studio-client-documents';
import {studioArchiveJsonBytes,STUDIO_ARCHIVE_MAX_BYTES} from '../packages/studio-documents/src/transport';
const id='10000000-0000-4000-8000-000000000004',hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const config=snapshotCostingControlConfigV1(loadCostingConfigV1()),published=resolvePublishedCostingConfigurationRecordV1({id,versionNumber:2,status:'published',config,contentHash:hashCostingControlConfigV1(config),baseManifestVersion:config.baseManifestVersion});
 const result=calculateStudioCommercialPricing(studioClientDocumentFixture(),published.config);
 return{siteInputs:result.siteInputs,siteOutput:result.siteOutput,publication:published.provenance,configuration:{schemaVersion:'studio_costing_configuration_archive.v1',opaqueUnchangedRepresentation:'sentinel'},atomicCreateRequest:{requestId:'frozen-intent'},atomicSaveReceipt:{revision:3},otherPrivateEvidence:{retained:true}};
}
it('roundtrips full actual canonical costing output and real resolver provenance while preserving every other evidence representation',async()=>{
 const original=fixture(),before=studioArchiveJsonBytes(original),packed=await packStudioFrozenAudit(original,id);expect(original.publication.versionId).toBe(id);expect(original.publication).not.toHaveProperty('id');
 expect(packed).not.toHaveProperty('siteInputs');expect(packed).not.toHaveProperty('siteOutput');expect(packed.audit).toMatchObject({schemaVersion:'studio_costing_audit_archive.v1',publicationId:id,publicationContentHash:original.publication.contentHash});
 expect(studioArchiveJsonBytes(packed).length).toBeLessThan(before.length);expect(studioArchiveJsonBytes(original)).toEqual(before);
 const decoded=await unpackStudioFrozenAuditEvidence(packed);expect(studioArchiveJsonBytes(decoded)).toEqual(before);expect(decoded.configuration).toBe(original.configuration);expect(decoded.atomicCreateRequest).toBe(original.atomicCreateRequest);expect(decoded.atomicSaveReceipt).toBe(original.atomicSaveReceipt);expect(decoded.otherPrivateEvidence).toBe(original.otherPrivateEvidence);
 expect(await unpackStudioFrozenAuditEvidence(original)).toBe(original);
});
it('retains the plain representation when archiving a tiny valid audit would be larger',async()=>{
 const original={...fixture(),siteInputs:{},siteOutput:{}};expect(await packStudioFrozenAudit(original,id)).toBe(original);
});
it('decodes equivalent gzip representations into identical full getters and retains different logical audit hashes',async()=>{
 const original=fixture(),packed=await packStudioFrozenAudit(original,id),envelope=packed.audit as any,raw=studioArchiveJsonBytes({siteInputs:original.siteInputs,siteOutput:original.siteOutput});
 for(const level of[1,9]){const compressed=gzipSync(raw,{level}),value={...packed,audit:{...envelope,archive:{...envelope.archive,compressedBytes:compressed.length,compressedSha256:hash(compressed),contentBase64:compressed.toString('base64')}}};expect(studioArchiveJsonBytes(await unpackStudioFrozenAuditEvidence(value))).toEqual(studioArchiveJsonBytes(original));}
 const changed=await packStudioFrozenAudit({...original,siteOutput:{...original.siteOutput,site_days:99}},id);expect((changed.audit as any).archive.sha256).not.toBe(envelope.archive.sha256);
});
it('refuses ambiguous, unknown, mismatched-publication, corrupt and oversize audit records without decoding configuration implicitly',async()=>{
 const original=fixture(),packed=await packStudioFrozenAudit(original,id),envelope=packed.audit as any;
 for(const value of[{...packed,siteInputs:original.siteInputs},{...packed,siteOutput:original.siteOutput},{...packed,audit:{...envelope,schemaVersion:'studio_costing_audit_archive.v99'}},{...packed,audit:{...envelope,publicationId:'wrong'}},{...packed,audit:{...envelope,publicationContentHash:'0'.repeat(64)}},{...packed,audit:{...envelope,extra:true}},{...packed,audit:{...envelope,archive:{...envelope.archive,sha256:'0'.repeat(64)}}},{...packed,audit:{...envelope,archive:{...envelope.archive,decodedBytes:STUDIO_ARCHIVE_MAX_BYTES+1}}}])await expect(unpackStudioFrozenAuditEvidence(value)).rejects.toThrow();
 await expect(packStudioFrozenAudit(original,'10000000-0000-4000-8000-000000000099')).rejects.toThrow('publication');
 await expect(packStudioFrozenAudit({...original,publication:{...original.publication,versionId:undefined,id}},id)).rejects.toThrow('publication');
});
it('rejects a valid compressed record with extra decoded keys or a missing audit side',async()=>{
 const original=fixture(),packed=await packStudioFrozenAudit(original,id),envelope=packed.audit as any;
 for(const value of[{siteInputs:original.siteInputs},{siteInputs:original.siteInputs,siteOutput:original.siteOutput,unexpected:true}]){
  const raw=studioArchiveJsonBytes(value),compressed=gzipSync(raw),archive={...envelope.archive,decodedBytes:raw.length,compressedBytes:compressed.length,sha256:hash(raw),compressedSha256:hash(compressed),contentBase64:compressed.toString('base64')};await expect(unpackStudioFrozenAuditEvidence({...packed,audit:{...envelope,archive}})).rejects.toThrow('audit');
 }
});
it('retains the complete prior preparation owner except the bounded audit admission before replay',()=>{
 const prior=readFileSync(new URL('../supabase/migrations/20261028132459_studio_client_document_archives.sql',import.meta.url),'utf8'),current=readFileSync(new URL('../supabase/migrations/20261028143455_studio_costing_audit_archive.sql',import.meta.url),'utf8'),start='create or replace function public.studio_client_quote_prepare(';
 const former=prior.slice(prior.indexOf(start)),added=" if not private.studio_costing_audit_stored_valid(p_private_evidence,p_publication_id)\n  then raise exception 'studio_costing_audit_invalid'; end if;\n";
 expect(current.slice(current.indexOf(start)).replace(added,'')).toBe(former);expect(current.indexOf(added)).toBeLessThan(current.indexOf('select * into replay',current.indexOf(start)));expect(current).toContain("evidence#>>'{publication,versionId}'");expect(current).not.toContain("evidence#>>'{publication,id}'");
});
