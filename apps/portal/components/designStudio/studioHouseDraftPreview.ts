import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import type {StudioHouse} from '@/lib/designStudio/studioHouseScene';
import {updateStudioHouse} from '@/lib/designStudio/studioHouseCommands';
import {solveStudioHouse} from '@/lib/designStudio/studioHouseGeometry';

/** The same command produces preview and Apply; authored input stays untouched. */
export function studioHouseDraftPreview(edit:StudioAuthoringEdit, house:StudioHouse|null) {
 if(!house)return {edit:null,error:null};
 try{solveStudioHouse(house);return {edit:updateStudioHouse(edit,house),error:null};}
 catch(error){return {edit:null,error:error instanceof Error?error.message:'House preview unavailable.'};}
}
