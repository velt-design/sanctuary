import {z} from 'zod';
import {hash,id,creativeSchema} from './contract';
export const creativeHistoryRequestSchema=z.object({generation:z.number().int().positive(),controlAd:id,control:creativeSchema,template:hash}).strict();
export const creativeHistoryV2EntrySchema=z.object({copyHash:hash,hookPrefix:z.string().max(160),result:z.enum(['reverted','inconclusive','retained']),
 observedAt:z.iso.datetime({offset:true}),reason:z.enum(['formal_interval','no_enquiries','no_delivery','evidence_incomplete']),
 enquiries:z.tuple([z.number().int().min(0).max(2000),z.number().int().min(0).max(2000)]),
 coverage:z.object({allSaved:z.enum(['complete','unknown']),unassigned:z.number().int().min(0).max(2000)}).strict().refine(v=>(v.allSaved==='complete')===(v.unassigned===0)),
 spend:z.tuple([z.number().finite().nonnegative().nullable(),z.number().finite().nonnegative().nullable()]),
 quality:z.enum(['passes','unknown_or_fails'])}).strict();
export const creativeHistoryEntrySchema=creativeHistoryV2EntrySchema.extend({policy:z.enum(['native-saved-enquiry-per-dollar-v1','native-saved-enquiry-per-dollar-v2']),sensitivityInterval:z.object({lower:z.number().finite().nonnegative(),upper:z.number().finite().nonnegative().nullable(),upperUnbounded:z.boolean()}).strict().nullable()}).refine(v=>v.policy==='native-saved-enquiry-per-dollar-v1'?v.sensitivityInterval===null:!v.sensitivityInterval||v.sensitivityInterval.upperUnbounded===(v.sensitivityInterval.upper===null)&&(v.sensitivityInterval.upper===null||v.sensitivityInterval.upper>=v.sensitivityInterval.lower));
export const creativeHistorySchema=z.object({version:z.literal(3),generation:z.number().int().positive(),controlAd:id,template:hash,
 previous:z.array(creativeHistoryEntrySchema).max(4),excluded:z.array(hash).max(64),complete:z.boolean()}).strict();
