const record=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
export const hasRetiredStandardEnhancements=(value:unknown)=>Object.hasOwn(record(record(value)?.creative_features_spec)??{},'standard_enhancements');
const replacements=['video_auto_crop','text_optimizations','inline_comment'] as const;

/** Meta v22+ retires this bundle on new/edited ads. Explicit individual values
 * take precedence here: never infer OPT_IN or discard unknown feature settings.
 * https://developers.facebook.com/blog/post/2025/01/17/marketing-api-v22-impacts-to-advantage-plus-creative-enhancements/
 */
export function writableVideoEnhancements<T>(input:T):T{
 const root=record(input),features=record(root?.creative_features_spec);
 if(!root)throw new Error('Complete video enhancement wrapper required');
 if(!hasRetiredStandardEnhancements(input))return structuredClone(input);
 if(!features)throw new Error('Complete video feature settings required');
 const legacy=record(features.standard_enhancements);
 if(!legacy||Object.keys(legacy).length!==1||!['OPT_IN','OPT_OUT'].includes(String(legacy.enroll_status)))throw new Error('Unsupported retired enhancement bundle');
 for(const name of replacements){const feature=record(features[name]);if(!feature||!['OPT_IN','OPT_OUT'].includes(String(feature.enroll_status)))throw new Error('Explicit individual video enhancement required');}
 const copy=structuredClone(input),next=record(record(copy)?.creative_features_spec)!;
 delete next.standard_enhancements;
 // All other feature objects, customizations and wrapper fields are preserved.
 return copy;
}
