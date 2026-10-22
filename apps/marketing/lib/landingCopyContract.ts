/** Shared plain-text surface contract, mirrored by Sanctuary. No markup,
 * links, prices, new technical claims or arbitrary layout/CSS instructions. */
export const COPY_CATALOGUE = {
  explore:{slot:'design',text:'Explore your pergola'},
  project:{slot:'help',text:'Tell us about your project'},
  estimate:{slot:'support',text:'Choose a size and roof. See an installed estimate.'},
  'action-first':{slot:'layout',text:'Hero action group before support on mobile'},
} as const;
export const AUTHOR_WORDS='a an and around choose covered deck design designed details estimate explore for get help home in installed living next of on outdoor pergola plan planning project residential roof see size space start step tell the to us with your'.split(' ');
export type CopySlot='design'|'help'|'support'|'layout';
export type CopyKey=keyof typeof COPY_CATALOGUE|`copy:${'design'|'help'|'support'}:${string}`;
export function copyChoice(value:unknown):{slot:CopySlot;text:string}|null{
 if(typeof value!=='string')return null;
 if(Object.hasOwn(COPY_CATALOGUE,value))return COPY_CATALOGUE[value as keyof typeof COPY_CATALOGUE];
 const match=/^copy:(design|help|support):([A-Za-z][A-Za-z ,.?!]*)$/.exec(value);
 if(!match)return null;
 const slot=match[1] as 'design'|'help'|'support',text=match[2]!;
 if(text.length<4||text.length>(slot==='support'?112:48)||text!==text.trim()||/ {2}|[,.?!]{2}/.test(text))return null;
 const words=text.toLowerCase().split(/[ ,.?!]+/).filter(Boolean);
 if(words.length<2||words.length>20||words.some(word=>!AUTHOR_WORDS.includes(word)))return null;
 return{slot,text};
}
