'use client';
import {useEffect,useState} from 'react';
import {ButtonLink} from '@/components/ui/foundation';
export default function StudioProjectLink({projectId}:{projectId:string}){const [enabled,setEnabled]=useState(false);useEffect(()=>{const abort=new AbortController();fetch('/api/design-studio/capabilities',{signal:abort.signal}).then(r=>r.ok?r.json():null).then(r=>setEnabled(r?.enabled===true)).catch(()=>{});return()=>abort.abort();},[]);return enabled?<ButtonLink href={`/staff/projects/${encodeURIComponent(projectId)}/studio`} size="small">Design Studio</ButtonLink>:null;}
