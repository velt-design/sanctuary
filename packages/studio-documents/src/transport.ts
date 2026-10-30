import {createHash} from 'node:crypto';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
import {parseStudioClientDocumentSource,isApprovedStudioDocumentLayout,STUDIO_DOCUMENT_SOURCE_SCHEMA,STUDIO_DOCUMENT_RENDERER_VERSION,type StudioClientDocumentSource} from './contract';

export const STUDIO_ARCHIVE_MAX_BYTES=16*1024*1024;
// JSONB's text presentation adds whitespace. Reserve more than the bounded
// header needs so an emitted archive also fits the existing SQL column cap.
export const STUDIO_ARCHIVE_WIRE_BYTES=STUDIO_ARCHIVE_MAX_BYTES-4096;
export type StudioArchiveKind='studio-drawing-core.v1'|'studio-costing-configuration.v1'|'studio-costing-audit.v1';
export type StudioJsonArchive={schemaVersion:'studio_json_gzip.v1';kind:StudioArchiveKind;encoding:'gzip-base64';decodedBytes:number;compressedBytes:number;sha256:string;compressedSha256:string;contentBase64:string};
export type StudioDrawingArchive={schemaVersion:'studio_client_document_archive.v1';sourceSchemaVersion:typeof STUDIO_DOCUMENT_SOURCE_SCHEMA;rendererVersion:typeof STUDIO_DOCUMENT_RENDERER_VERSION;snapshotId:string;contentHash:string;designVersionLabel:string;products:{id:string;code:string;label:string}[];layoutVersion?:'studio-booklet-layout.v3'|'studio-booklet-layout.v4';pageManifest?:StudioClientDocumentSource['pageManifest'];issuedAt:string;issuedDate:string;logicalBytes:number;logicalSha256:string;archive:StudioJsonArchive};
const zip=promisify(gzip),unzip=promisify(gunzip),hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const count=(value:unknown,max=STUDIO_ARCHIVE_MAX_BYTES):value is number=>Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=max;
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Frozen JSON contains a non-finite number.');
 return value;
}
export function studioArchiveJsonBytes(value:unknown):Buffer{return Buffer.from(JSON.stringify(canonical(value)),'utf8');}
/** A bounded stateless Node codec, never a configuration or pricing resolver. */
export async function encodeStudioJsonArchive(value:unknown,kind:StudioArchiveKind):Promise<StudioJsonArchive>{
 const raw=studioArchiveJsonBytes(value);if(!count(raw.length))throw Error('Frozen JSON exceeds the archive size.');
 const compressed=await zip(raw,{level:6});if(!count(compressed.length))throw Error('Compressed frozen JSON exceeds the archive size.');
 return{schemaVersion:'studio_json_gzip.v1',kind,encoding:'gzip-base64',decodedBytes:raw.length,compressedBytes:compressed.length,sha256:hash(raw),compressedSha256:hash(compressed),contentBase64:compressed.toString('base64')};
}
export async function decodeStudioJsonArchive(value:unknown,kind:StudioArchiveKind,signal?:AbortSignal):Promise<unknown>{
 signal?.throwIfAborted();
 if(!exact(value,['schemaVersion','kind','encoding','decodedBytes','compressedBytes','sha256','compressedSha256','contentBase64'])||value.schemaVersion!=='studio_json_gzip.v1'||value.kind!==kind||value.encoding!=='gzip-base64'
  ||!count(value.decodedBytes)||!count(value.compressedBytes)||!digest(value.sha256)||!digest(value.compressedSha256)||typeof value.contentBase64!=='string'||value.contentBase64.length>STUDIO_ARCHIVE_WIRE_BYTES
  ||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.contentBase64)||studioArchiveJsonBytes(value).length>STUDIO_ARCHIVE_WIRE_BYTES)throw Error('Frozen archive is invalid.');
 const compressed=Buffer.from(value.contentBase64,'base64');
 if(compressed.length!==value.compressedBytes||compressed.toString('base64')!==value.contentBase64||hash(compressed)!==value.compressedSha256||compressed[0]!==31||compressed[1]!==139)throw Error('Frozen archive failed its compressed hash check.');
 const raw=await unzip(compressed,{maxOutputLength:Math.min(STUDIO_ARCHIVE_MAX_BYTES,value.decodedBytes)});signal?.throwIfAborted();
 if(raw.length!==value.decodedBytes||hash(raw)!==value.sha256)throw Error('Frozen archive failed its decoded hash check.');
 const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(hash(studioArchiveJsonBytes(decoded))!==value.sha256)throw Error('Frozen archive is not canonical JSON.');
 return decoded;
}
function drawingIdentity(source:StudioClientDocumentSource){return{sourceSchemaVersion:source.schemaVersion,rendererVersion:source.rendererVersion,snapshotId:source.snapshotId,contentHash:source.contentHash,designVersionLabel:source.designVersionLabel,products:source.products.map(p=>({id:p.id,code:p.code,label:p.label})),...(isApprovedStudioDocumentLayout(source.layoutVersion)?{layoutVersion:source.layoutVersion,pageManifest:source.pageManifest}:{})};}
export async function packStudioDrawing(value:unknown):Promise<StudioClientDocumentSource|StudioDrawingArchive>{
 const source=parseStudioClientDocumentSource(value),raw=studioArchiveJsonBytes(source);
 if(raw.length>STUDIO_ARCHIVE_WIRE_BYTES)return source;
 const {issuedAt,issuedDate,...core}=source;
 const packed:StudioDrawingArchive={schemaVersion:'studio_client_document_archive.v1',...drawingIdentity(source),issuedAt,issuedDate,logicalBytes:raw.length,logicalSha256:hash(raw),archive:await encodeStudioJsonArchive(core,'studio-drawing-core.v1')};
 return studioArchiveJsonBytes(packed).length<raw.length&&studioArchiveJsonBytes(packed).length<=STUDIO_ARCHIVE_WIRE_BYTES?packed:source;
}
/** Plain historical rows retain their original parser. Unknown archive shapes
 * never fall through to being interpreted as plain drawing data. */
export async function unpackStudioDrawing(value:unknown,signal?:AbortSignal):Promise<StudioClientDocumentSource>{
 signal?.throwIfAborted();
 if(object(value)&&value.schemaVersion===STUDIO_DOCUMENT_SOURCE_SCHEMA&&!Object.hasOwn(value,'archive'))return parseStudioClientDocumentSource(value);
 const keys=['schemaVersion','sourceSchemaVersion','rendererVersion','snapshotId','contentHash','designVersionLabel','products','issuedAt','issuedDate','logicalBytes','logicalSha256','archive'];
 if(object(value)&&isApprovedStudioDocumentLayout(value.layoutVersion))keys.push('layoutVersion','pageManifest');
 if(!exact(value,keys)
  ||value.schemaVersion!=='studio_client_document_archive.v1'||value.sourceSchemaVersion!==STUDIO_DOCUMENT_SOURCE_SCHEMA||value.rendererVersion!==STUDIO_DOCUMENT_RENDERER_VERSION||!digest(value.contentHash)||!digest(value.logicalSha256)||!count(value.logicalBytes)
  ||typeof value.snapshotId!=='string'||typeof value.designVersionLabel!=='string'||typeof value.issuedAt!=='string'||typeof value.issuedDate!=='string'||!Array.isArray(value.products)||value.products.length>32||studioArchiveJsonBytes(value).length>STUDIO_ARCHIVE_WIRE_BYTES)throw Error('Frozen drawing transport is invalid.');
 const core=await decodeStudioJsonArchive(value.archive,'studio-drawing-core.v1',signal);
 if(!object(core)||Object.hasOwn(core,'issuedAt')||Object.hasOwn(core,'issuedDate'))throw Error('Frozen drawing core is invalid.');
 const source=parseStudioClientDocumentSource({...core,issuedAt:value.issuedAt,issuedDate:value.issuedDate}),raw=studioArchiveJsonBytes(source);
 if(raw.length!==value.logicalBytes||hash(raw)!==value.logicalSha256||!studioArchiveJsonBytes(drawingIdentity(source)).equals(studioArchiveJsonBytes({sourceSchemaVersion:value.sourceSchemaVersion,rendererVersion:value.rendererVersion,snapshotId:value.snapshotId,contentHash:value.contentHash,designVersionLabel:value.designVersionLabel,products:value.products,...(isApprovedStudioDocumentLayout(value.layoutVersion)?{layoutVersion:value.layoutVersion,pageManifest:value.pageManifest}:{})})))throw Error('Frozen drawing identity does not match its archive.');
 return source;
}
