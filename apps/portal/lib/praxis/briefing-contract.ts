import { z } from 'zod';
export const BRIEFING_LIMIT = 5000;
export const BRIEFING_MAX_BYTES = 2 * 1024 * 1024;
export const BRIEFING_SCHEMA = 'sanctuary.praxis.briefing.v1' as const;
const id=z.string().uuid(),text=z.string().min(1).max(256),stamp=z.string().datetime({offset:true}).transform(v=>new Date(v).toISOString());
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const briefingFacts = {
  enquiries:z.object({contactId:id.nullable(),enquiryType:text.nullable(),createdAt:stamp}).strict(),
  projects:z.object({name:text,contactId:id,contactName:text,contactEmail:z.string().max(254).nullable(),stage:z.string().max(100).nullable(),archivedAt:stamp.nullable(),createdAt:stamp}).strict(),
  quoteVersions:z.object({quoteId:id,quoteRef:z.string().max(100).nullable(),versionNumber:z.number().int().positive(),status:text,
    sentAt:stamp.nullable(),acceptedAt:stamp.nullable(),supersededAt:stamp.nullable(),expiresAt:z.union([day,stamp]).nullable(),totalIncGstCents:z.number().int().nonnegative().safe()}).strict(),
  manualWork:z.object({title:z.string().min(1).max(160),status:z.enum(['OPEN','BLOCKED','DONE','CANCELLED']),projectState:z.enum(['ACTIVE','WAITING','CLOSED','ARCHIVED']),
    identityKind:z.enum(['staff','projectOwner','unassigned']),identityKey:z.string().max(100).nullable(),identityName:text,
    dueAt:stamp,completedAt:stamp.nullable(),completedBy:id.nullable()}).strict(),
  installation:z.object({status:z.enum(['not_started','in_progress','paused','done']),identityKind:z.literal('crew'),identityKey:id.nullable(),identityName:text,
    identityActive:z.boolean().nullable(),projectPresent:z.boolean(),archived:z.boolean(),plannedStart:day.nullable(),forecastStart:day.nullable(),forecastEndExclusive:day.nullable(),actualStart:day.nullable(),actualFinish:day.nullable()}).strict(),
  design:z.object({status:z.enum(['OPEN','IN_PROGRESS','BLOCKED','DONE','CANCELLED']),identityKind:z.literal('designer'),identityKey:id.nullable(),identityName:text,
    projectPresent:z.boolean(),archived:z.boolean(),requestedAt:stamp,dueAt:stamp.nullable(),startedAt:stamp.nullable(),completedAt:stamp.nullable(),cancelledAt:stamp.nullable()}).strict(),
};
export type BriefingDomain=keyof typeof briefingFacts;
export const briefingRecordSchemas={
  enquiries:z.object({id,projectId:id.nullable(),recordedAt:stamp,facts:briefingFacts.enquiries}).strict(),
  projects:z.object({id,projectId:id,recordedAt:stamp,facts:briefingFacts.projects}).strict(),
  quoteVersions:z.object({id,projectId:id,recordedAt:stamp,facts:briefingFacts.quoteVersions}).strict(),
  manualWork:z.object({id,projectId:id,recordedAt:stamp,facts:briefingFacts.manualWork}).strict(),
  installation:z.object({id,projectId:id,recordedAt:stamp,facts:briefingFacts.installation}).strict(),
  design:z.object({id,projectId:id,recordedAt:stamp,facts:briefingFacts.design}).strict(),
};
const unavailable=z.object({status:z.literal('unavailable'),reason:z.enum(['projection_missing','invalid_projection','record_limit']),limit:z.literal(BRIEFING_LIMIT)}).strict();
function domain<T extends z.ZodTypeAny>(record:T) {return z.union([z.object({status:z.literal('available'),complete:z.literal(true),count:z.number().int().min(0).max(BRIEFING_LIMIT),limit:z.literal(BRIEFING_LIMIT),fingerprint:z.string().regex(/^[a-f0-9]{64}$/),records:z.array(record).max(BRIEFING_LIMIT)}).strict(),unavailable]);}
export const briefingSchema=z.object({schemaVersion:z.literal(BRIEFING_SCHEMA),requestId:id,source:z.object({sourceKey:z.string(),connectionId:id,environment:z.string(),authority:z.literal('canonical'),asOf:stamp,retrievedAt:stamp}).strict(),
  semantics:z.literal('net_state_between_observations'),exclusion:z.literal('labelled_measurement_test_20260916'),
  domains:z.object({enquiries:domain(briefingRecordSchemas.enquiries),projects:domain(briefingRecordSchemas.projects),quoteVersions:domain(briefingRecordSchemas.quoteVersions),manualWork:domain(briefingRecordSchemas.manualWork),installation:domain(briefingRecordSchemas.installation),design:domain(briefingRecordSchemas.design)}).strict(),
  cash:z.object({status:z.literal('unavailable'),reason:z.literal('business_cash_not_projected')}).strict(),limitations:z.array(z.string().min(1).max(500)).min(1).max(20),
}).strict();
export type BriefingSnapshot=z.infer<typeof briefingSchema>;
