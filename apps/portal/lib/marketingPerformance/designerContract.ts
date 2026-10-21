import { z } from 'zod';
import { salesDesignerSchema } from './salesDesigner';
const stamp=z.string().datetime({offset:true}).nullable(), day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const designerVisitSchema=z.object({
  id:z.string().uuid(),projectId:z.string().uuid().nullable(),contactId:z.string().uuid().nullable(),origin:z.enum(['outlook','history']),
  day:day.nullable(),at:stamp,purpose:z.enum(['site_visit','initial','measurement','follow_up']).nullable(),
  status:z.enum(['booked','provisional','cancelled','attended','not_attended']).nullable(),kind:z.enum(['visit','provisional','review','excluded']),
  staff:z.array(z.string().min(1).max(50)).max(20),unmappedStaff:z.number().int().nonnegative(),
  removed:z.boolean(),withdrawn:z.boolean(),cancelled:z.boolean(),duplicate:z.boolean(),changed:z.boolean(),questions:z.number().int().nonnegative(),
});
const designerScopeSchema=z.object({id:z.string().uuid(),projectId:z.string().uuid(),reference:z.string(),addOn:z.boolean(),
  firstSentAt:stamp,undatedSend:z.boolean(),accepted:z.boolean(),acceptedAt:stamp,valueCents:z.number().int().nonnegative().nullable(),paymentEvidence:z.boolean(),paidAt:stamp});
export const designerReportSchema=z.object({schemaVersion:z.literal(1),asOf:z.string().datetime({offset:true}),start:day,end:day,
  source:z.object({enabled:z.boolean(),lastSuccess:stamp,failed:z.boolean(),rangeStart:stamp,rangeEnd:stamp,firstImportedAt:stamp}),
  visits:z.array(designerVisitSchema).max(5000),scopes:z.array(designerScopeSchema).max(5000),assignments:z.array(salesDesignerSchema).max(5000),
}).superRefine((r,c)=>{if(new Set(r.visits.map(v=>v.id)).size!==r.visits.length||new Set(r.scopes.map(s=>s.id)).size!==r.scopes.length
  ||new Set(r.assignments.map(a=>a.projectId)).size!==r.assignments.length
  ||r.visits.some(v=>new Set(v.staff).size!==v.staff.length))c.addIssue({code:'custom',message:'Duplicate reporting evidence'});});
export type DesignerReport=z.infer<typeof designerReportSchema>;
export type DesignerVisit=z.infer<typeof designerVisitSchema>;
export type DesignerScope=z.infer<typeof designerScopeSchema>;
