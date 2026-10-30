// @vitest-environment node
import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {packStudioDrawing,unpackStudioDrawing,encodeStudioJsonArchive,decodeStudioJsonArchive,studioArchiveJsonBytes,STUDIO_ARCHIVE_MAX_BYTES} from '../packages/studio-documents/src/transport';
import {projectStudioClientDocument} from '../apps/portal/lib/designStudio/clientDocumentProjection.server';
import {studioClientDocumentFixture} from './fixtures/studio-client-documents';
import {addWebsitePergola} from '../apps/portal/lib/designStudio/websiteComposition';
import {loadCostingConfigV1,snapshotCostingControlConfigV1} from '@sp/costing';
import {hashCostingControlConfigV1,resolvePublishedCostingConfigurationRecordV1} from '@sp/costing/server';
import {mapCostingConfigurationVersion} from '../apps/portal/lib/costing/configurationShared';
import {packStudioFrozenConfiguration,unpackStudioFrozenConfiguration} from '../apps/portal/lib/costing/configurationArchive.server';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const identity={designVersionLabel:'V6',snapshotId:'10000000-0000-4000-8000-000000000006',contentHash:'a'.repeat(64),projectName:'Synthetic transport proof',siteAddress:'12 Example Road',issuedAt:'2026-10-29T00:00:00Z',issuedDate:'29 OCT 2026'};
function fixture(){const edit=addWebsitePergola(studioClientDocumentFixture(),'box'),roof=(edit.objectOptions.find(p=>p.objectId==='box')!.values.websiteDesign as any).selection.roof;roof.family='box';roof.attachmentIntent='freestanding';edit.spatial.pergolas.find(p=>p.id==='box')!.family='box';return projectStudioClientDocument(edit,identity);}
function configuration(){const config=snapshotCostingControlConfigV1(loadCostingConfigV1());return mapCostingConfigurationVersion({id:'10000000-0000-4000-8000-000000000004',version_number:2,name:'Synthetic configuration',purpose:'Archive validation',status:'published',schema_version:'costing-configuration.v1',base_manifest_version:config.baseManifestVersion,config_json:config,content_hash:hashCostingControlConfigV1(config),created_at:identity.issuedAt,created_by_email:'test@example.com',updated_at:identity.issuedAt,updated_by_email:'test@example.com'});}
it('preserves full canonical three-roof drawing bytes/hash and the logical renderer contract with a much smaller transport',async()=>{
 const source=fixture(),packed=await packStudioDrawing(source);expect(packed.schemaVersion).toBe('studio_client_document_archive.v1');
 const decoded=await unpackStudioDrawing(packed);expect(decoded).toEqual(source);expect(studioArchiveJsonBytes(decoded)).toEqual(studioArchiveJsonBytes(source));expect(decoded.rendererVersion).toBe('studio-booklet.v1');
 expect(studioArchiveJsonBytes(packed).length).toBeLessThan(studioArchiveJsonBytes(source).length/3);
 if(packed.schemaVersion==='studio_client_document_archive.v1'){expect(packed.logicalSha256).toBe(hash(studioArchiveJsonBytes(source)));expect(packed.products.map(p=>p.id)).toEqual(source.products.map(p=>p.id));}
});
it('keeps prepare retry date-insensitive while reconstructing every original issued field and full logical hash',async()=>{
 const source=fixture(),first=await packStudioDrawing(source),second=await packStudioDrawing({...source,issuedAt:'2026-11-01T00:00:00Z',issuedDate:'1 NOV 2026'});
 if(first.schemaVersion!=='studio_client_document_archive.v1'||second.schemaVersion!=='studio_client_document_archive.v1')throw Error('Expected archives');
 const retry=(value:typeof first)=>{const {issuedAt:_at,issuedDate:_date,logicalBytes:_bytes,logicalSha256:_hash,...stable}=value;return stable;};
 expect(retry(first)).toEqual(retry(second));expect((await unpackStudioDrawing(second)).issuedDate).toBe('1 NOV 2026');expect(first.logicalSha256).not.toBe(second.logicalSha256);
});
it('retains old plain sources and falls back to plain when a complete archive would be larger',async()=>{
 const source=fixture();expect(await unpackStudioDrawing(source)).toEqual(source);
 const tiny={...source,products:[],houses:[],joins:[],projectName:'A',siteAddress:''};const packed=await packStudioDrawing(tiny);expect(packed.schemaVersion).toBe('studio_client_document.v1');expect(await unpackStudioDrawing(packed)).toEqual(tiny);
});
it('refuses corrupt/unknown/oversize/hash/identity transports before renderer use',async()=>{
 const packed=await packStudioDrawing(fixture());if(packed.schemaVersion!=='studio_client_document_archive.v1')throw Error('Expected archive');
 await expect(unpackStudioDrawing({...packed,schemaVersion:'studio_client_document_archive.v99'})).rejects.toThrow();
 await expect(unpackStudioDrawing({...packed,snapshotId:'wrong'})).rejects.toThrow('identity');
 await expect(unpackStudioDrawing({...packed,logicalSha256:'0'.repeat(64)})).rejects.toThrow('identity');
 for(const archive of [{...packed.archive,decodedBytes:STUDIO_ARCHIVE_MAX_BYTES+1},{...packed.archive,decodedBytes:10},{...packed.archive,sha256:'0'.repeat(64)},{...packed.archive,contentBase64:'AAAA='},{...packed.archive,kind:'unknown'},{...packed.archive,extra:true}])await expect(unpackStudioDrawing({...packed,archive})).rejects.toThrow();
 const signal=new AbortController();signal.abort();await expect(unpackStudioDrawing(packed,signal.signal)).rejects.toThrow();await expect(unpackStudioDrawing(fixture(),signal.signal)).rejects.toThrow();
});
it('rejects valid compressed hashes containing malformed gzip or noncanonical duplicate-key JSON',async()=>{
 const archive=await encodeStudioJsonArchive({a:1},'studio-drawing-core.v1');
 const invalid=Buffer.from('not a gzip stream');await expect(decodeStudioJsonArchive({...archive,compressedBytes:invalid.length,compressedSha256:hash(invalid),contentBase64:invalid.toString('base64')},'studio-drawing-core.v1')).rejects.toThrow();
 const raw=Buffer.from('{"a":1,"a":2}'),compressed=gzipSync(raw);await expect(decodeStudioJsonArchive({...archive,decodedBytes:raw.length,compressedBytes:compressed.length,sha256:hash(raw),compressedSha256:hash(compressed),contentBase64:compressed.toString('base64')},'studio-drawing-core.v1')).rejects.toThrow('canonical');
});
it('provides a full configuration audit/export decode through the real mapper/resolver/hash/control validation',async()=>{
 const record=configuration(),packed=await packStudioFrozenConfiguration(record);expect(packed.schemaVersion).toBe('studio_costing_configuration_archive.v1');
 expect(await unpackStudioFrozenConfiguration(packed)).toEqual(record);expect(await unpackStudioFrozenConfiguration(record)).toEqual(record);
 expect(()=>resolvePublishedCostingConfigurationRecordV1(packed as any)).toThrow();expect(()=>mapCostingConfigurationVersion(packed)).toThrow();
 await expect(packStudioFrozenConfiguration({...record,contentHash:'0'.repeat(64)})).rejects.toThrow('hash');
 await expect(unpackStudioFrozenConfiguration({...packed,versionId:'wrong'})).rejects.toThrow('identity');
 await expect(unpackStudioFrozenConfiguration({...packed,schemaVersion:'unknown_archive.v1'})).rejects.toThrow();
});
