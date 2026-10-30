'use client';
import {createContext,type RefObject} from 'react';
import type {QuoteVersionDetail} from '@/lib/quotes/types';
import type {StudioAuthoringResponse} from '@/lib/designStudio/authoringRequest.server';
import type {StudioOpeningPrice,StudioOpeningScope} from '@/lib/designStudio/studioOpening';
import type {StudioReviewResponse} from '@/lib/designStudio/studioReviewOpening';

export type StudioDocumentAdmission={turn:number;scope:StudioOpeningScope;theme:Record<string,string>}&(
 {kind:'edit';authoring:StudioAuthoringResponse;openingPrice?:StudioOpeningPrice}|
 {kind:'review';response:StudioReviewResponse;openingPrice?:StudioOpeningPrice}
);
/** Ephemeral frame/page communication, never cached authoring or admission. */
export const StudioDocumentContext=createContext<{
 callback:string;admissionCallback?:string;
 /** Adopt only an already reconciled committed quote in this same live frame. */
 adoptCommittedQuote?:(input:{actorId:string;requestId:string;quote:QuoteVersionDetail})=>void;
 admission:StudioDocumentAdmission|null;visible:boolean;error:string|null;leaving:boolean;
 /** Public code-preload projection only. Never actor or edit admission. */
 requestIssued?:Readonly<{turn:number;signal:AbortSignal}>|null;
 frame:RefObject<HTMLDivElement|null>;retry:()=>void;
}|null>(null);
