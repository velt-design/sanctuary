import type {StudioAuthoringEdit} from './authoringView';
import type {HouseReference,StudioHouseAttachment} from './studioHouseScene';
import {studioHouseScene} from './studioHouseScene';
import {previewStudioAttachment,resolveStudioAttachment} from './studioHouseCommands';
import {websiteComposition} from './websiteComposition';

export type StudioAttachmentChoice=Omit<StudioHouseAttachment,'reference'>;
/** Retain the chosen physical side and tangential world anchor. The new method
 * alone owns normal contact and height. Out-of-span positions remain refusals. */
export function previewStudioAttachmentAtAnchor(edit:StudioAuthoringEdit,choice:StudioAttachmentChoice,anchor:HouseReference['position']|null){
 if(!anchor)return {edit:previewStudioAttachment(edit,choice),choice};
 const zero={...choice,alongEdgeMm:0},base=previewStudioAttachment(edit,zero);
 const scene=studioHouseScene(base.site,base.spatial)!,binding=scene.attachments.find(a=>a.objectId===choice.objectId)!;
 const row=websiteComposition(base).find(p=>p.object.id===choice.objectId)!;
 const resolved=resolveStudioAttachment(scene,binding,row.value!);
 if(resolved.error||!resolved.target||!resolved.position)throw Error(resolved.error??'The connection cannot be resolved.');
 let {start,end}=resolved.target;
 const dx=end.x-start.x,dy=end.y-start.y;
 if(-dy*(resolved.target.centre.x-(start.x+end.x)/2)+dx*(resolved.target.centre.y-(start.y+end.y)/2)>0)[start,end]=[end,start];
 const length=Math.hypot(end.x-start.x,end.y-start.y);
 const along=(anchor.x-resolved.position.x)*(end.x-start.x)/length+(anchor.y-resolved.position.y)*(end.y-start.y)/length;
 const retained={...choice,alongEdgeMm:Math.abs(along)<1e-7?0:along};
 return {edit:previewStudioAttachment(edit,retained),choice:retained};
}
