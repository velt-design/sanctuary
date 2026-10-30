import 'server-only';
import {resolvePublishedCostingConfigurationRecordV1} from '@sp/costing/server';
import {encodeStudioJsonArchive,decodeStudioJsonArchive,studioArchiveJsonBytes,STUDIO_ARCHIVE_WIRE_BYTES,type StudioJsonArchive} from '@sp/studio-documents/transport';
import {mapCostingConfigurationVersion,type CostingConfigurationVersion} from './configurationShared';

export type StudioConfigurationArchive={schemaVersion:'studio_costing_configuration_archive.v1';versionId:string;versionNumber:number;contentHash:string;archive:StudioJsonArchive};
function validate(value:unknown):CostingConfigurationVersion{
 const r=value as CostingConfigurationVersion;
 if(!r||typeof r!=='object'||Object.hasOwn(r,'archive'))throw Error('Frozen costing configuration is invalid.');
 const mapped=mapCostingConfigurationVersion({id:r.id,version_number:r.versionNumber,name:r.name,purpose:r.purpose,status:r.status,schema_version:r.schemaVersion,base_manifest_version:r.baseManifestVersion,based_on_version_id:r.basedOnVersionId,config_json:r.config,content_hash:r.contentHash,created_at:r.createdAt,created_by_email:r.createdByEmail,updated_at:r.updatedAt,updated_by_email:r.updatedByEmail,published_at:r.publishedAt,published_by_email:r.publishedByEmail,publish_note:r.publishNote,publication_diff:r.publicationDiff,publication_impact:r.publicationImpact});
 resolvePublishedCostingConfigurationRecordV1(mapped);
 return r;
}
export async function packStudioFrozenConfiguration(value:unknown):Promise<CostingConfigurationVersion|StudioConfigurationArchive>{
 const record=validate(value),raw=studioArchiveJsonBytes(record);
 if(raw.length>STUDIO_ARCHIVE_WIRE_BYTES)return record;
 const packed:StudioConfigurationArchive={schemaVersion:'studio_costing_configuration_archive.v1',versionId:record.id,versionNumber:record.versionNumber,contentHash:record.contentHash,archive:await encodeStudioJsonArchive(record,'studio-costing-configuration.v1')};
 return studioArchiveJsonBytes(packed).length<raw.length&&studioArchiveJsonBytes(packed).length<=STUDIO_ARCHIVE_WIRE_BYTES?packed:record;
}
/** Explicit audit/export boundary. Stored archives are never usable as a live
 * costing record without the existing mapping, control validation and hash check. */
export async function unpackStudioFrozenConfiguration(value:unknown):Promise<CostingConfigurationVersion>{
 const r=value as Record<string,unknown>;
 if(r?.schemaVersion!=='studio_costing_configuration_archive.v1')return validate(value);
 if(Object.keys(r).sort().join(',')!=='archive,contentHash,schemaVersion,versionId,versionNumber'||studioArchiveJsonBytes(r).length>STUDIO_ARCHIVE_WIRE_BYTES)throw Error('Frozen configuration transport is invalid.');
 const record=validate(await decodeStudioJsonArchive(r.archive,'studio-costing-configuration.v1'));
 if(record.id!==r.versionId||record.versionNumber!==r.versionNumber||record.contentHash!==r.contentHash)throw Error('Frozen configuration identity does not match its archive.');
 return record;
}
