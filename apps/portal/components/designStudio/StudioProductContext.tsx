'use client';
import {useEffect,type ReactNode} from 'react';
import {LightingProvider,PreviewBlindProvider,useLighting} from '@sp/configurator/react/controls';
import type {ResolvedStudioProduct} from '@/lib/designStudio/interaction/resolvedScene';
/** Nonselected products own their accessory contexts; the selected product uses the live inspector providers. */
export default function StudioProductContext({row,active,night,children}:{row:Readonly<Pick<ResolvedStudioProduct,'design'|'geometry'|'geometryOptions'>>;active:boolean;night:boolean;children:ReactNode}){
 if(active||!row.design)return children;
 return <LightingProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} preparedGeometry={row.geometry??null} onChange={()=>{}}><PreviewBlindProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} preparedGeometry={row.geometry??null} onChange={()=>{}} readOnly><Night value={night}/>{children}</PreviewBlindProvider></LightingProvider>;
}
function Night({value}:{value:boolean}){const lighting=useLighting();useEffect(()=>{lighting?.setNight(value);},[value]);return null;}
