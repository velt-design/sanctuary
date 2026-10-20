import { z } from 'zod';

const visitPersonSchema = z.object({name:z.string().trim().min(1).max(150),email:z.union([z.email().max(254),z.literal('')]),staffId:z.string().max(80).optional()}).strict();
const visitTimingSchema = z.object({
  mode:z.enum(['agreed','window','date','unknown']),date:z.iso.date().nullable(),
  time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).strict().refine(t=>t.mode==='unknown'?t.date===null&&t.time===null&&t.endTime===null:
  Boolean(t.date)&&(t.mode==='date'?t.time===null&&t.endTime===null:t.mode==='agreed'?Boolean(t.time)&&t.endTime===null:Boolean(t.time&&t.endTime&&t.endTime>t.time)),{message:'Check the date and time fields.'});
const visitDetailsSchema=z.object({
  staff:z.array(visitPersonSchema).max(20).optional(),address:z.string().trim().max(500).nullable().optional(),
  purpose:z.enum(['site_visit','initial','measurement','follow_up']).optional(),
  status:z.enum(['booked','provisional','cancelled','attended','not_attended']).optional(),
  timing:visitTimingSchema.optional(),
}).strict();
export type VisitDetails=z.infer<typeof visitDetailsSchema>;
export type VisitTiming=z.infer<typeof visitTimingSchema>;
export type VisitPerson=z.infer<typeof visitPersonSchema>;
const evidence={details:visitDetailsSchema,questions:z.array(z.string().trim().min(3).max(300)).max(8),
  basis:z.string().trim().min(5).max(2000),referenceUrl:z.url().max(3000).refine(v=>v.startsWith('https://'),{message:'Use an https source link.'}).nullable()};
export const correctionCommand=z.object({action:z.enum(['save','restore']),id:z.uuid(),revision:z.number().int().positive(),
  projectId:z.uuid().nullable(),linkMode:z.enum(['manual','auto']),kind:z.enum(['visit','provisional','review','excluded']).nullable(),...evidence}).strict();
export const historyCommand=z.object({action:z.enum(['save','withdraw','restore']),id:z.uuid(),revision:z.number().int().nonnegative(),projectId:z.uuid(),...evidence}).strict()
  .refine(v=>Boolean(v.details.staff?.length)&&Boolean(v.details.timing)&&Boolean(v.details.purpose)&&['attended','not_attended'].includes(v.details.status??''),{message:'Record who attended, the known timing and the historical outcome.'});
export type VisitCorrection={details:VisitDetails;questions:string[];basis:string;referenceUrl:string|null;updatedAt:string;sourceChanged:boolean};
