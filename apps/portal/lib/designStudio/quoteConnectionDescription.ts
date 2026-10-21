import type {websiteComposition} from './websiteComposition';
/** Separate a selected commercial connection from a physically placed house relationship. */
export function quoteConnectionDescription(object:ReturnType<typeof websiteComposition>[number]):string {
 const labels={facade:'Wall',fascia:'Fascia',soffit:'Soffit brackets'};
 if(object.studioAttachment)return `${labels[object.studioAttachment.method]} connection to the ${object.studioAttachment.edge} house edge`;
 if(object.design?.roof.attachmentIntent==='freestanding')return 'Freestanding';
 const method=object.design?.input.connection;
 return `${method?`${labels[method]} connection`:'House connection'} selected. No house edge is assigned.`;
}
