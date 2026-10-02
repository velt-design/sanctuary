'use client';
import { useEffect,useState } from 'react';
import { Select } from '@/components/ui/foundation/FoundationControls';
export default function FinancialScenarioControl(){
  const [scenario,setScenario]=useState('complete');
  useEffect(()=>{setScenario(new URLSearchParams(window.location.search).get('financeScenario')??'complete');},[]);
  return <details style={{maxWidth:480,margin:'24px 20px',fontSize:13}}><summary>Financials demo scenarios</summary><p>Fictional source behavior. Choose a scenario, then use Refresh Xero in Financials.</p><Select label="Demo source response" value={scenario} onChange={event=>{setScenario(event.target.value);const url=new URL(window.location.href);url.searchParams.set('financeScenario',event.target.value);window.history.replaceState(null,'',url);}}>
    <option value="complete">Complete reports</option><option value="partial">Missing bills and comparison</option><option value="bank-failure">Bank read unavailable</option><option value="empty">No outstanding invoices or bills</option><option value="failure">Whole source unavailable</option>
  </Select></details>;
}
