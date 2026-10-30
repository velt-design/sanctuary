'use client';
import {useEffect,useState} from 'react';
import {ButtonLink} from '@/components/ui/foundation';
export default function StudioProjectLink({projectId,disabled=false}:{projectId:string;disabled?:boolean}){const [enabled,setEnabled]=useState<boolean|null>(null);useEffect(()=>{const abort=new AbortController();fetch('/api/design-studio/capabilities',{signal:abort.signal}).then(r=>r.ok?r.json():null).then(r=>{if(!abort.signal.aborted)setEnabled(r?.enabled===true);}).catch(()=>{if(!abort.signal.aborted)setEnabled(false);});return()=>abort.abort();},[]);return enabled!==false?<ButtonLink href={`/staff/projects/${encodeURIComponent(projectId)}/studio`} disabled={disabled||enabled!==true} size="small">Design Studio</ButtonLink>:null;}
