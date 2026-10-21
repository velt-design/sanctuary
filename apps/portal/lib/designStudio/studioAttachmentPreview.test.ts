import {expect,it} from 'vitest';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '../drawings/state/objectFirstWorkbenchModel';
import {applyStudioHouseEdit} from './houseEditing';
import {addWebsitePergola,websiteComposition} from './websiteComposition';
import {previewStudioAttachment,updateStudioHouse} from './studioHouseCommands';
import {studioHouseScene} from './studioHouseScene';
import {previewStudioAttachmentAtAnchor} from './studioAttachmentPreview';
import {parseStudioAuthoringEdit,type StudioAuthoringEdit} from './authoringView';
function fixture(rotation='0'){
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'anchor-proof',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 const h=applyStudioHouseEdit(edit.spatial,{kind:'add',id:'house'});if(!h.ok)throw Error(h.message);edit.spatial=h.spatial;
 edit=updateStudioHouse(edit,{...studioHouseScene(edit.site,edit.spatial)!.houses[0],widthMm:'8000',wallHeightMm:'3200',eaveHeightMm:'3200',roof:{...studioHouseScene(edit.site,edit.spatial)!.houses[0].roof,fasciaHeightMm:'350'},position:{xMm:'310',yMm:'-520',rotationDeg:rotation}});
 return previewStudioAttachment(addWebsitePergola(edit,'p'),{objectId:'p',houseId:'house',edge:'rear',kind:'eave',method:'soffit',alongEdgeMm:500.2084557579392});
}
it.each(['0','37'])('preserves a nonzero world anchor through method cycling and saved reload at %s degrees',rotation=>{
 const edit=fixture(rotation),original=JSON.stringify(edit),row=websiteComposition(edit)[0],choice={...row.studioAttachment!,method:'fascia' as const};
 const proposed=previewStudioAttachmentAtAnchor(edit,choice,row.position!);
 const posed=websiteComposition(proposed.edit)[0].position!,rad=Number(rotation)*Math.PI/180;
 expect((posed.x-row.position!.x)*Math.cos(rad)+(posed.y-row.position!.y)*Math.sin(rad)).toBeCloseTo(0,6);
 const back=previewStudioAttachmentAtAnchor(edit,{...choice,method:'soffit'},posed);
 expect(websiteComposition(back.edit)[0].position!.x).toBeCloseTo(row.position!.x,6);
 expect(websiteComposition(back.edit)[0].position!.y).toBeCloseTo(row.position!.y,6);
 expect(JSON.stringify(edit)).toBe(original);
 const saved=parseStudioAuthoringEdit(JSON.parse(JSON.stringify(proposed.edit)));if(!saved.ok)throw Error(saved.message);
 expect(websiteComposition(saved.value)[0].position).toEqual(posed);
});
it('keeps the original anchor after a refused method and refuses out-of-span movement instead of clamping',()=>{
 const edit=fixture(),row=websiteComposition(edit)[0],choice=row.studioAttachment!,anchor=row.position!;
 const low=updateStudioHouse(edit,{...studioHouseScene(edit.site,edit.spatial)!.houses[0],wallHeightMm:'2400',eaveHeightMm:'2400'});
 expect(()=>previewStudioAttachmentAtAnchor(low,{...choice,method:'facade',kind:'wall'},anchor)).toThrow(/support at/);
 const restored=previewStudioAttachmentAtAnchor(low,choice,anchor);
 expect(websiteComposition(restored.edit)[0].position).toEqual(anchor);
 expect(()=>previewStudioAttachmentAtAnchor(edit,choice,{...anchor,x:anchor.x-10000})).toThrow(/beyond/);
 expect(websiteComposition(edit)[0].position).toEqual(anchor);
});
