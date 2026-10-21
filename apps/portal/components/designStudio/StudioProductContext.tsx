'use client';
import {useEffect,type ReactNode} from 'react';
import {LightingProvider,PreviewBlindProvider,useLighting} from '@sp/configurator/react/controls';
import type {websiteComposition} from '@/lib/designStudio/websiteComposition';
/** Nonselected products own their accessory contexts; the selected product uses the live inspector providers. */
export default function StudioProductContext({row,active,night,children}:{row:ReturnType<typeof websiteComposition>[number];active:boolean;night:boolean;children:ReactNode}){
 if(active||!row.design)return children;
 return <LightingProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} onChange={()=>{}}><PreviewBlindProvider input={row.design.input} roof={row.design.roof} geometryOptions={row.geometryOptions} onChange={()=>{}} readOnly><Night value={night}/>{children}</PreviewBlindProvider></LightingProvider>;
}
function Night({value}:{value:boolean}){const lighting=useLighting();useEffect(()=>{lighting?.setNight(value);},[value]);return null;}
