import type {ObjectFirstHouseFormDraft as House, ObjectFirstWorkbenchDraftVNext as Spatial} from '../drawings/state/objectFirstWorkbenchModel';
export type HouseSide='front'|'right'|'rear'|'left';
/** Transient interaction projection. The canonical source is never saved here. */
export type StudioHouse={id:string;label:string;widthMm:string;depthMm:string;wallHeightMm:string;eaveHeightMm?:string;roof:{form:'flat'|'mono'|'hipped';pitchDeg:string;fall:HouseSide;ridge:'width'|'depth';overhangMm:string;fasciaHeightMm?:string};position:{xMm:string;yMm:string;rotationDeg:string};source:House};
export type HouseReference={position:{x:number;y:number;rotation:number};supportDatumMm:number};
export type StudioHouseAttachment={objectId:string;houseId:string;edge:HouseSide;kind:'wall'|'eave';method:'facade'|'fascia'|'soffit';reference:HouseReference;alongEdgeMm?:number;contactBasis?:'canonical-house.v1'};
/** Command-only setting, written once to the pergola option owner, never copied
 * into the physical binding or its retained display reference. */
export type StudioHouseConnectionChoice=Omit<StudioHouseAttachment,'reference'>&{facadeClearanceMm?:string};
export type StudioHouseScene={schemaVersion:'studio_house_scene.v1';houses:StudioHouse[];attachments:StudioHouseAttachment[]};
export type WebsiteAttachments={schemaVersion:'website_attachments.v1';attachments:StudioHouseAttachment[]};
export function parseWebsiteAttachments(value:unknown):WebsiteAttachments {
 const exact=(v:unknown,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('Unsupported house connection fields.');return v as Record<string,unknown>;};
 const v=exact(value,['schemaVersion','attachments']);if(v.schemaVersion!=='website_attachments.v1'||!Array.isArray(v.attachments)||v.attachments.length>100)throw Error('Unsupported house connections.');
 const ids=new Set<string>();for(const raw of v.attachments){const a=exact(raw,['objectId','houseId','edge','kind','method','reference','alongEdgeMm','contactBasis']);
 for(const key of ['objectId','houseId'])if(typeof a[key]!=='string'||!a[key]||String(a[key]).trim()!==a[key])throw Error('Invalid connection identity.');
 if(ids.has(a.objectId as string))throw Error('Duplicate house connection.');ids.add(a.objectId as string);
 if(!['front','right','rear','left'].includes(String(a.edge))||!['wall','eave'].includes(String(a.kind))||!['facade','fascia','soffit'].includes(String(a.method))||(a.kind==='wall')!==(a.method==='facade')||a.contactBasis!=='canonical-house.v1')throw Error('Unsupported house connection method.');
 const r=exact(a.reference,['position','supportDatumMm']),p=exact(r.position,['x','y','rotation']);for(const n of [p.x,p.y,p.rotation,r.supportDatumMm,a.alongEdgeMm??0])if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e9)throw Error('Invalid connection reference.');
 if(Number(r.supportDatumMm)<=0||Number(a.alongEdgeMm??0)<0)throw Error('Invalid connection datum.');
 }
 return structuredClone(value) as WebsiteAttachments;
}
/** Structural identity validation never solves geometry. Invalid authored dimensions
 * remain repairable; only contradictory attachment authority is rejected. */
export function validateWebsiteAttachments(site:{websiteAttachments?:unknown}|undefined,spatial:Spatial):StudioHouseAttachment[] {
 const attachments=site?.websiteAttachments===undefined?[]:parseWebsiteAttachments(site.websiteAttachments).attachments;
 for(const a of attachments){
  const p=spatial.pergolas.find(p=>p.id===a.objectId),host=p?.attachment?.host;
  const method=a.method==='facade'?'facade_ledger':a.method==='fascia'?'fascia_under_gutter':'direct_to_soffit';
  if(!spatial.houseAssembly?.houseForms.some(h=>h.id===a.houseId)||!p||host?.objectFamily!=='house_forms'||host.objectId!==a.houseId||host.edgeKind!==(a.kind==='wall'?'wall':'roof_eave')||p.attachment?.method!==method||p.attachmentEdgeId!==host.edgeId)
   throw Error('Saved house connection disagrees with its canonical host. Repair the connection.');
 }
 return attachments;
}
