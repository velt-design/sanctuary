import { z } from 'zod';
const salesDesignerKeySchema=z.enum(['ellen','jordan','jp','joe','bruce','dave']);
export const salesDesignerSchema=z.object({projectId:z.string().uuid(),designerKey:salesDesignerKeySchema.nullable(),
  revision:z.number().int().nonnegative(),updatedAt:z.string().datetime({offset:true}).nullable(),basis:z.string().max(500).nullable()});
export const salesDesignerCommandSchema=z.object({commandId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),
  designerKey:salesDesignerKeySchema.nullable(),basis:z.string().trim().min(3).max(500)}).strict();
export type SalesDesigner=z.infer<typeof salesDesignerSchema>;
export type SalesDesignerCommand=z.infer<typeof salesDesignerCommandSchema>;
export const unassignedDesigner=(projectId:string):SalesDesigner=>({projectId,designerKey:null,revision:0,updatedAt:null,basis:null});
