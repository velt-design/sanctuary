'use client';
import { useState } from 'react';
import { SlidersHorizontal, Bookmark, X } from 'lucide-react';
import { Button, Select } from '@/components/ui/foundation/FoundationControls';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { dateRanges, matchingPreset, presetDates, type DateRange } from '@/lib/marketingPerformance/dateRanges';
import { validPeriod } from '@/lib/marketingPerformance/contract';
import { evidenceOptions, type HubFilters as Filters, type HubReport } from '@/lib/marketingPerformance/hub';
import HubFilters from './HubFilters';
import styles from './MarketingPerformance.module.css';

export default function HubToolbar({filters,apply,hub}:{filters:Filters;apply:(f:Filters)=>void;hub:HubReport|null}) {
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(filters),[validation,setValidation]=useState(''),[savedOnly,setSavedOnly]=useState(false);
  const edit=(saved=false)=>{setSavedOnly(saved);setDraft(filters);setValidation('');setOpen(true);};
  const labels:Record<string,string>={source:'Source',campaign:'Campaign',owner:'Owner',stage:'Stage',state:'State',evidence:'Evidence',age:'Open age'};
  const keys=['source','campaign','owner','stage','state','evidence',...(filters.view==='portfolio'?['age']:[])] as const;
  const active=keys.filter(key=>Boolean(filters[key as keyof Filters])&&filters[key as keyof Filters]!=='all');
  const commit=(next:Filters)=>{if(!validPeriod(next.start,next.end)){setValidation('Choose valid dates, up to 366 days ending today or earlier.');return;}apply(next);setOpen(false);};
  return <>
    <div className={styles.toolbar}>
      <Select label="Date range" value={matchingPreset(filters.start,filters.end)??'custom'} onChange={e=>e.target.value==='custom'?edit():apply({...filters,...presetDates(e.target.value as DateRange)})}>
        {dateRanges.map(([key,label])=><option key={key} value={key}>{label}</option>)}<option value="custom">Custom dates</option>
      </Select>
      <Button variant="quiet" className={styles.dateLabel} onClick={()=>edit()}>{new Date(filters.start+'T12:00:00Z').toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})} – {new Date(filters.end+'T12:00:00Z').toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</Button>
      <div className={styles.toolbarActions}><Button variant="secondary" onClick={()=>edit()}><SlidersHorizontal size={16} aria-hidden="true"/>Filters{active.length?` · ${active.length}`:''}</Button><Button variant="quiet" onClick={()=>edit(true)}><Bookmark size={16} aria-hidden="true"/>Saved views</Button></div>
    </div>
    <div className={styles.filterChips} aria-label="Applied filters">{!active.length&&<span>All sources · All owners</span>}{active.map(key=><Button variant="quiet" key={key} onClick={()=>apply({...filters,[key]:key==='evidence'?'all':''})} aria-label={`Remove ${labels[key]} filter`}>{labels[key]}: {key==='evidence'?evidenceOptions.find(e=>e[0]===filters.evidence)?.[1]:String(filters[key as keyof Filters]).replaceAll('_',' ')}<X size={13} aria-hidden="true"/></Button>)}</div>
    <Drawer title={savedOnly?"Saved views":"Filters"} open={open} onClose={()=>setOpen(false)}>
      <div className={styles.filterDrawer}><HubFilters draft={draft} setDraft={setDraft} apply={commit} hub={hub} validation={validation} savedOnly={savedOnly}/></div>
    </Drawer>
  </>;
}
