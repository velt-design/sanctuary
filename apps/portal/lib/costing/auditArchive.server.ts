import 'server-only';
import {decodeStudioJsonArchive,encodeStudioJsonArchive,studioArchiveJsonBytes,STUDIO_ARCHIVE_WIRE_BYTES,type StudioJsonArchive} from '@sp/studio-documents/transport';

export type StudioFrozenCostingAudit={siteInputs:Record<string,unknown>;siteOutput:Record<string,unknown>};
export type StudioCostingAuditArchive={schemaVersion:'studio_costing_audit_archive.v1';publicationId:string;publicationContentHash:string;archive:StudioJsonArchive};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
function publication(evidence:Record<string,unknown>,expectedId?:string){
 const value=evidence.publication;
 if(!object(value)||value.schemaVersion!=='costing-provenance.v1'||value.source!=='published'||typeof value.versionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.versionId)
  ||typeof value.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(value.contentHash)||(expectedId!==undefined&&value.versionId!==expectedId))throw Error('Frozen costing audit publication is invalid.');
 return{id:value.versionId,contentHash:value.contentHash};
}
function audit(value:unknown):StudioFrozenCostingAudit{
 if(!object(value)||!exact(value,['siteInputs','siteOutput'])||!object(value.siteInputs)||!object(value.siteOutput))throw Error('Frozen costing audit is invalid.');
 return{siteInputs:value.siteInputs,siteOutput:value.siteOutput};
}
/** Only the freshly calculated audit changes representation. All other evidence,
 * including any configuration archive, remains exactly as supplied. */
export async function packStudioFrozenAudit(value:unknown,publicationId:string):Promise<Record<string,unknown>>{
 if(!object(value)||Object.hasOwn(value,'audit'))throw Error('Frozen costing evidence is invalid.');
 const identity=publication(value,publicationId),logical=audit({siteInputs:value.siteInputs,siteOutput:value.siteOutput}),raw=studioArchiveJsonBytes(logical);
 if(raw.length>STUDIO_ARCHIVE_WIRE_BYTES)return value;
 const packed:StudioCostingAuditArchive={schemaVersion:'studio_costing_audit_archive.v1',publicationId:identity.id,publicationContentHash:identity.contentHash,archive:await encodeStudioJsonArchive(logical,'studio-costing-audit.v1')};
 if(studioArchiveJsonBytes(packed).length>=raw.length||studioArchiveJsonBytes(packed).length>STUDIO_ARCHIVE_WIRE_BYTES)return value;
 const {siteInputs:_inputs,siteOutput:_output,...rest}=value;
 return{...rest,audit:packed};
}
/** Private audit/export boundary, not a live pricing input. Decode only the audit
 * trace; configuration decoding is an explicit separate validated operation. */
export async function unpackStudioFrozenAuditEvidence(value:unknown):Promise<Record<string,unknown>&StudioFrozenCostingAudit>{
 if(!object(value))throw Error('Frozen costing evidence is invalid.');
 if(!Object.hasOwn(value,'audit')){audit({siteInputs:value.siteInputs,siteOutput:value.siteOutput});return value as Record<string,unknown>&StudioFrozenCostingAudit;}
 if(Object.hasOwn(value,'siteInputs')||Object.hasOwn(value,'siteOutput'))throw Error('Frozen costing audit has ambiguous representations.');
 const identity=publication(value),packed=value.audit;
 if(!object(packed)||!exact(packed,['schemaVersion','publicationId','publicationContentHash','archive'])||packed.schemaVersion!=='studio_costing_audit_archive.v1'
  ||packed.publicationId!==identity.id||packed.publicationContentHash!==identity.contentHash||studioArchiveJsonBytes(packed).length>STUDIO_ARCHIVE_WIRE_BYTES)throw Error('Frozen costing audit transport is invalid.');
 const decoded=audit(await decodeStudioJsonArchive(packed.archive,'studio-costing-audit.v1'));
 const {audit:_archive,...rest}=value;
 return{...rest,...decoded};
}
