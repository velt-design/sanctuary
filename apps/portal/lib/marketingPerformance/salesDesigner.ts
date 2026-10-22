import { z } from 'zod';
import { PROJECT_OWNER_OPTIONS } from '@/lib/projects/commandCentre/projectOwners';
const salesDesignerKeySchema=z.enum(['ellen','jordan','jp','joe','bruce','dave','steve']);
export const salesDesignerSchema=z.object({projectId:z.string().uuid(),designerKey:salesDesignerKeySchema.nullable(),
  revision:z.number().int().nonnegative(),updatedAt:z.string().datetime({offset:true}).nullable(),basis:z.string().max(500).nullable()});
export const salesDesignerCommandSchema=z.object({commandId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),
  designerKey:salesDesignerKeySchema.nullable(),basis:z.string().trim().min(3).max(500)}).strict();
export type SalesDesigner=z.infer<typeof salesDesignerSchema>;
export type SalesDesignerCommand=z.infer<typeof salesDesignerCommandSchema>;
export const unassignedDesigner=(projectId:string):SalesDesigner=>({projectId,designerKey:null,revision:0,updatedAt:null,basis:null});

// Historical sales credit is independent of current project-owner or attendee roles.
export const SALES_DESIGNER_OPTIONS=[...PROJECT_OWNER_OPTIONS,{key:'steve',displayName:'Steve'}] as const;
export const salesDesignerOption=(key:unknown)=>SALES_DESIGNER_OPTIONS.find(option=>option.key===key)??null;
