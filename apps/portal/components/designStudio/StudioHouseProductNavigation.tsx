'use client';
import {useEffect,useState} from 'react';
import {useLighting,usePreviewBlinds} from '@sp/configurator/react/controls';
import {readWebsiteViewContext,type WebsiteViewContext} from './studioViewContext';
/** Small website navigation seam, scoped per Studio object; never authored design or price data. */
export default function StudioHouseProductNavigation({storageKey,section,choose,optionsActive=true}:{optionsActive?:boolean;storageKey:string;section:WebsiteViewContext['section'];choose:(s:WebsiteViewContext['section'])=>void}){
 const light=useLighting()!,blinds=usePreviewBlinds()!,[restored,setRestored]=useState<string|null>(null);
 useEffect(()=>{try{const c=readWebsiteViewContext(sessionStorage.getItem(storageKey),blinds.openings.map(o=>o.id));if(c){if(c.opening)blinds.select(c.opening);choose(c.section);if(c.section==='Lighting')light.open();else light.close();light.setTool(c.tool??null);light.setNight(c.night);}}catch{}setRestored(storageKey);},[storageKey]);
 // Placement tasks retain the chosen tool/night but cannot edit accessories.
 useEffect(()=>{if(restored!==storageKey)return;const tool=light.tool,night=light.night;if(optionsActive&&section==='Lighting'){light.open();light.setTool(tool);light.setNight(night);}else{light.close();if(!optionsActive)light.setNight(night);}blinds.setEditing(optionsActive&&section==='Sides');},[restored,storageKey,section,optionsActive]);
 useEffect(()=>{if(restored!==storageKey)return;try{sessionStorage.setItem(storageKey,JSON.stringify({section,night:light.night,opening:blinds.selected,view:light.view,tool:light.tool}));}catch{}},[restored,storageKey,section,light.night,blinds.selected,light.view,light.tool]);
 return null;
}
