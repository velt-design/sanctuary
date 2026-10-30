import {isStudioObject} from './contracts';
import {parseStudioAuthoringEdit} from './authoringView';
import type {StudioPendingCommand} from './saveTransport';

export function parseStudioAtomicQuoteCommand(value:unknown):StudioPendingCommand{
 if(!isStudioObject(value)||Object.keys(value).sort().join(',')!=='edit,expectedRevision,expectedUpdatedAt,requestId'
  ||typeof value.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestId)
  ||!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<1
  ||typeof value.expectedUpdatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value.expectedUpdatedAt)||!Number.isFinite(Date.parse(value.expectedUpdatedAt)))throw Error('Invalid saved design identity.');
 const edit=parseStudioAuthoringEdit(value.edit);
 if(!edit.ok||edit.value.revision!==value.expectedRevision)throw Error('The edit does not match its saved revision.');
 return structuredClone(value) as unknown as StudioPendingCommand;
}
