import {useEffect,useRef,useState} from 'react';
import type {CostingConfigurationOverview} from '@/lib/costing/configurationAdmin';
type Input={initialOverview?:CostingConfigurationOverview;initialOverviewRead?:Promise<CostingConfigurationOverview|null>;busy:boolean;dirty:boolean};
/** Initial Flight ownership and legacy refresh adoption retain the existing
 * dirty/busy guard. No default overview or draft is constructed while unknown. */
export function useCostingOverview({initialOverview,initialOverviewRead,busy,dirty}:Input){
 const [overview,setOverview]=useState<CostingConfigurationOverview|null>(initialOverview??null);
 const [pending,setPending]=useState(Boolean(initialOverviewRead&&!initialOverview)),[error,setError]=useState('');
 const settledRead=useRef<Input['initialOverviewRead']>(undefined);
 const signature=useRef(JSON.stringify(initialOverview));
 useEffect(()=>{
  if(!initialOverview||dirty||busy)return;
  const next=JSON.stringify(initialOverview);if(next===signature.current)return;
  signature.current=next;setOverview(initialOverview);
 },[initialOverview,busy,dirty]);
 useEffect(()=>{
  if(!initialOverviewRead||settledRead.current===initialOverviewRead||busy||dirty)return;let active=true;
  void Promise.resolve(initialOverviewRead).then(value=>{if(active){settledRead.current=initialOverviewRead;setOverview(value);if(!value)setError('Pricing configuration overview could not be loaded. Retry.');}},()=>{if(active){settledRead.current=initialOverviewRead;setError('Pricing configuration overview could not be loaded. Retry.');}}).finally(()=>{if(active)setPending(false);});
  return()=>{active=false;};
 },[initialOverviewRead,busy,dirty]);
 return {overview,setOverview,pending,setPending,error,setError};
}
