import {prepareGestureTemplates} from './directDemo/gestureTemplates';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
self.onmessage=(event:MessageEvent<{requestId:number;edit:StudioAuthoringEdit}>)=>{try{self.postMessage({requestId:event.data.requestId,pack:prepareGestureTemplates(event.data.edit)});}catch(error){self.postMessage({requestId:event.data.requestId,error:error instanceof Error?error.message:'Placement unavailable.'});}};
