import {z} from 'zod';

// UNDEFINED is preserved literally. This is the selected-ad export/UI-backed
// inherited website case, not an SDK destination alias or a write parameter.
const id=z.string().regex(/^[1-9]\d{0,19}$/);
export const inheritedWebsiteSchema=z.object({destinationType:z.literal('UNDEFINED'),adset:id,pixel:id,
 optimizationGoal:z.literal('OFFSITE_CONVERSIONS'),billingEvent:z.literal('IMPRESSIONS'),event:z.literal('LEAD'),
 url:z.literal('https://www.sanctuarypergolas.co.nz/acrylic-roof-pergolas-auckland')}).strict();
export type InheritedWebsite=z.infer<typeof inheritedWebsiteSchema>;
type Control={format:string;path:string;payload?:unknown};
type Settings={id:string;optimization_goal:string;billing_event:string;destination_type:string;promoted_object:{pixel_id?:unknown;custom_event_type?:unknown}};
export function inheritedWebsiteFor(settings:Settings,adset:string,control:Control):InheritedWebsite|undefined{
 if(settings.destination_type==='WEBSITE')return undefined;
 if(settings.destination_type!=='UNDEFINED'||settings.id!==adset||control.format!=='video_story'||control.path!=='/acrylic-roof-pergolas-auckland')throw Error('Website destination differs');
 return inheritedWebsiteSchema.parse({destinationType:settings.destination_type,adset:settings.id,pixel:settings.promoted_object.pixel_id,
  optimizationGoal:settings.optimization_goal,billingEvent:settings.billing_event,event:settings.promoted_object.custom_event_type,
  url:z.object({object_story_spec:z.object({video_data:z.object({call_to_action:z.object({value:z.object({link:z.string()})})})})}).parse(control.payload).object_story_spec.video_data.call_to_action.value.link});
}
