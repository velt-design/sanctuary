import {expect,it} from 'vitest';
import {summarizeSavedStudioDesign,summarizeStudioQuoteDesign} from './studioDesignSummary';
import {prepareStudioCreation} from '@/lib/designStudio/createPreparation';
import {newStudioWebsiteDesign} from '@/lib/designStudio/websiteDesign';
it('summarizes all saved Studio objects without treating retained calculator modules as current',()=>{
 const made=prepareStudioCreation({mode:'blank',projectId:'proj_10000000-0000-4000-8000-000000000001',designId:'summary',commercialScopeId:null});
 if(!made.ok)throw Error(made.message);
 const outputs=made.prepared.row.outputs as any;
 const design=newStudioWebsiteDesign('p1');
 outputs.drawing_object_first.pergolas=[{id:'p1',label:'Courtyard',family:'mono',attachmentEdgeId:null,attachmentZoneId:null,side:'rear',strategy:null,position:{originXMm:'0',originYMm:'0',rotationDeg:'0'}}];
 outputs.studio_authored.objectOptions=[{objectId:'p1',options:{validation:'preserved_unvalidated',values:{websiteDesign:design}}}];
 const result=summarizeSavedStudioDesign(outputs);
 expect(result?.size).toBe('1 pergola');
 expect(result?.shape).toContain('Courtyard: Pitched · 6000 × 3000 mm');
 expect(summarizeSavedStudioDesign({studio_authored:{},drawing_object_first:{}})).toBeNull();
});
it('keeps all quoted roof sizes and house context from the immutable selection projection',()=>{
 const result=summarizeStudioQuoteDesign({selections:[{label:'One',details:['Pitched · 6000 × 3000 mm','Clear acrylic']},{label:'Two',details:['Gable · 5000 × 4000 mm','Opal acrylic']},{label:'Existing house',details:['Context']}]} as any);
 expect(result.size).toBe('2 pergolas + house');
 expect(result.shape).toContain('Two: Gable · 5000 × 4000 mm');
 expect(result.roofing).toBe('Clear acrylic · Opal acrylic');
});
