import type {StudioAuthoringEdit} from './authoringView';
import type {ObjectFirstHouseFormDraft as House} from '../drawings/state/objectFirstWorkbenchModel';
import {applyStudioHouseEdit,type StudioHouseEdit} from './houseEditing';

export type HouseFieldDraft=Record<string,string>;
export type HouseDrafts=Record<string,HouseFieldDraft>;
const details=['wallHeightM','eaveHeightM','soffitDepthMm','fasciaHeightMm','gutterWidthMm','gutterDepthMm','gutterProjectionMm','eaveOverhangMm'] as const;
const fixed=['x','y','rotation','form','pitch','fall','ridge',...details];
const allowed=(key:string)=>fixed.includes(key)||/^rectangle:\d+:(widthMm|depthMm|originXMm|originYMm)$/.test(key);
/** Local UI intent only: never enters geometry, authored save or price before Apply. */
export function readHouseDrafts(raw:string|null,ids:ReadonlySet<string>):HouseDrafts{
 try{const value=JSON.parse(raw??'{}');if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const result:HouseDrafts={};for(const [id,fields] of Object.entries(value)){if(!ids.has(id)||!fields||typeof fields!=='object'||Array.isArray(fields))continue;
 const entries=Object.entries(fields);if(entries.length>100||entries.some(([k,v])=>!allowed(k)||typeof v!=='string'||v.length>120))continue;result[id]=Object.fromEntries(entries) as HouseFieldDraft;}return result;
 }catch{return {};}
}
export function houseFieldValue(house:House,key:string):string{
 if(key.startsWith('rectangle:')){const [,index,field]=key.split(':');const p=house.composition.primitives[Number(index)];return p?.kind==='axisAlignedRectangle'?String(p[field as 'widthMm']):'';}
 const pos=house.position??{originXMm:String(house.transform.offsetXM*1000),originYMm:String(house.transform.offsetYM*1000),rotationDeg:String(house.transform.rotationQuarterTurns*90)};
 if(key==='x')return pos.originXMm;if(key==='y')return pos.originYMm;if(key==='rotation')return pos.rotationDeg;
 if(key==='form')return house.roofIntent.form;if(key==='pitch')return house.roofIntent.primaryPitchDeg;if(key==='fall')return house.roofIntent.primaryFallDirection;if(key==='ridge')return house.roofIntent.ridgeAxis;
 return String(house[key as typeof details[number]]??'');
}
export function applyWebsiteHouseFields(edit:StudioAuthoringEdit,houseId:string,fields:HouseFieldDraft):{ok:true;edit:StudioAuthoringEdit}|{ok:false;field:string;message:string}{
 let field='';try{
 const house=edit.spatial.houseAssembly?.houseForms.find(h=>h.id===houseId);if(!house)throw Error('This house is no longer available.');
 let spatial=edit.spatial;
 const run=(command:StudioHouseEdit)=>{const r=applyStudioHouseEdit(spatial,command);if(!r.ok)throw Error(r.message);spatial=r.spatial;};
 const get=(key:string)=>fields[key]??houseFieldValue(house,key);
 const number=(key:string)=>{field=key;const raw=get(key);if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())||!Number.isFinite(Number(raw)))throw Error('Enter a valid number. Your input is kept.');return Number(raw);};
 for(const [key,raw] of Object.entries(fields)){
  field=key;if(!allowed(key)||typeof raw!=='string'||raw.length>120)throw Error('Unsupported house field.');
  if(key.startsWith('rectangle:')){const [,index,name]=key.split(':');const n=number(key);if((name==='widthMm'||name==='depthMm')&&n<=0)throw Error('Enter a dimension greater than zero.');run({kind:'rectangle',houseFormId:houseId,primitiveIndex:Number(index),patch:{[name]:n}});}
  if(details.includes(key as typeof details[number])){if(raw.trim()!==''){const n=number(key);if(n<0||((key==='wallHeightM'||key==='eaveHeightM')&&n===0))throw Error('Enter a valid positive height or non-negative roof detail.');}run({kind:'details',houseFormId:houseId,patch:{[key]:raw}});}
 }
 if(['x','y','rotation'].some(k=>k in fields)){number('x');number('y');number('rotation');field='rotation';run({kind:'move',houseFormId:houseId,position:{originXMm:get('x'),originYMm:get('y'),rotationDeg:get('rotation')}});}
 if(['form','pitch','fall','ridge'].some(k=>k in fields)){number('pitch');field='pitch';run({kind:'roof',houseFormId:houseId,roof:{...house.roofIntent,form:get('form') as House['roofIntent']['form'],primaryPitchDeg:get('pitch'),primaryFallDirection:get('fall') as House['roofIntent']['primaryFallDirection'],ridgeAxis:get('ridge') as House['roofIntent']['ridgeAxis']}});}
 return {ok:true,edit:{...edit,spatial}};
 }catch(e){return {ok:false,field,message:e instanceof Error?e.message:'House edit unavailable.'};}
}
