import {parseStudioWebsiteDesign,type StudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
import type { StudioSaveScope } from '@/lib/designStudio/saveTransport';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';

export type StudioViewContext = { selectedRef: WorkbenchObjectRef; tab: 'Shape'|'Finish'|'Position'|'Site'; mode: 'plan'|'geometry3d' };
export const studioViewContextKey = (scope: StudioSaveScope) => `studio-view:v1:${[scope.actorId,scope.projectId,scope.estimateId,scope.designId].map(encodeURIComponent).join(':')}`;
export function readStudioViewContext(raw: string | null, objects: WorkbenchObjectRef[]): StudioViewContext | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !['Shape','Finish','Design','Structure','Position','Options','Site'].includes(value.tab) || !['plan','geometry3d'].includes(value.mode)) return null;
    const tab = value.tab === 'Design' || value.tab === 'Structure' ? 'Shape' : value.tab === 'Options' ? 'Finish' : value.tab;
    const selectedRef = objects.find(ref => ref.family === value.selectedRef?.family && ref.objectId === value.selectedRef?.objectId);
    return selectedRef ? {selectedRef,tab,mode:value.mode} : null;
  } catch { return null; }
}

export type WebsiteViewContext={section:'Shape'|'Roof'|'Sides'|'Lighting';night:boolean;opening:string;view?:'Plan'|'3D';tool?:'rafter'|'cedar'|'strip'|null};
export function readWebsiteViewContext(raw:string|null,openingIds:string[]):WebsiteViewContext|null {
 try {const value=JSON.parse(raw??'null');
  if(!value||!['Shape','Roof','Sides','Lighting'].includes(value.section)||typeof value.night!=='boolean'||typeof value.opening!=='string')return null;
  return {section:value.section,night:value.night,opening:openingIds.includes(value.opening)?value.opening:'',view:value.view==='Plan'?'Plan':'3D',tool:['rafter','cedar','strip'].includes(value.tool)?value.tool:null};
 } catch{return null;}
}

/** A tab-local comparison bookmark, scoped by authenticated design key and actual opening geometry. */
export function readStudioSideBookmark(raw:string|null,objectId:string,openingScope:string):StudioWebsiteDesign|null {
 try {if(!raw||raw.length>80000)return null;const saved=JSON.parse(raw);if(saved.version!==1||saved.openingScope!==openingScope)return null;const parsed=parseStudioWebsiteDesign(saved.design,objectId);return parsed.ok?parsed.value:null;}catch{return null;}
}
export function restoreStudioSideBookmark(current:StudioWebsiteDesign,saved:StudioWebsiteDesign):StudioWebsiteDesign {
 if(current.objectId!==saved.objectId)throw Error('The comparison belongs to another pergola.');
 const roof={...current.selection.roof};delete roof.blinds;delete roof.sidePanels;
 if(saved.selection.roof.blinds)roof.blinds=structuredClone(saved.selection.roof.blinds);
 if(saved.selection.roof.sidePanels)roof.sidePanels=structuredClone(saved.selection.roof.sidePanels);
 const rawGaps={...(current.rawGaps?.roof!==undefined?{roof:current.rawGaps.roof}:{}),...Object.fromEntries(Object.entries(saved.rawGaps??{}).filter(([key])=>key!=='roof'&&roof.sidePanels?.some(p=>p.opening===key)))};
 return {...current,selection:{...current.selection,roof},rawGaps};
}
