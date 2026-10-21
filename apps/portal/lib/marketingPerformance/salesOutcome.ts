import { z } from 'zod';
const outcome=z.enum(['cancelled','refunded','test']).nullable();
export const salesOutcomeSchema=z.object({projectId:z.string().uuid(),outcome,
  revision:z.number().int().nonnegative(),updatedAt:z.string().datetime({offset:true}).nullable(),basis:z.string().max(500).nullable()});
export const salesOutcomeCommandSchema=z.object({commandId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),
  outcome,basis:z.string().trim().min(3).max(500)}).strict();
export type SalesOutcome=z.infer<typeof salesOutcomeSchema>;
export type SalesOutcomeCommand=z.infer<typeof salesOutcomeCommandSchema>;
export const unrecordedSalesOutcome=(projectId:string):SalesOutcome=>({projectId,outcome:null,revision:0,updatedAt:null,basis:null});
