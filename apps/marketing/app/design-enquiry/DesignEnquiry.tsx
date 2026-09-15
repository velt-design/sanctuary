'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {usePreviewDraft} from '../../components/configurator-prototype/usePreviewDraft';
import {useConfiguratorPrice} from '../../components/configurator-prototype/useConfiguratorPrice';
import {solvePergolaPreview,solveSimpleCoverSurroundings} from '../../components/configurator-prototype/solvePreview';
import LightingProvider from '../../components/configurator-prototype/LightingProvider';
import RailProvider from '../../components/configurator-prototype/RailProvider';
import PreviewBlindProvider from '../../components/configurator-prototype/PreviewBlindProvider';
import PreviewPlan from '../../components/configurator-prototype/PreviewPlan';
import {reviewMoney} from '../../components/configurator-prototype/ReviewPriceDisplay';
import {customerPriceBreakdown} from '../../components/configurator-prototype/customerPriceBreakdown';
import {getRoofFinish} from '../../components/configurator-prototype/roofFinish';
import ContactEnquiryForm from '../contact/ContactEnquiryForm';
import {buildContactDesignBrief} from '../contact/contactDesignBrief';
import css from './enquiry.module.css';
import type { EnquiryContext } from '../../lib/enquiryContext';
const Scene=dynamic(()=>import('../../components/configurator-prototype/PreviewScene'),{ssr:false});
const noop=()=>{};
export default function DesignEnquiry({initialContext={}}:{initialContext?:EnquiryContext}){
 const draft=usePreviewDraft();
 const {input,roof,ready}=draft;
 const {price,retry}=useConfiguratorPrice({version:1,input,roof},ready);
 const [view,setView]=useState<'3D'|'Plan'>('3D');
 const geometry=useMemo(()=>solvePergolaPreview(input,roof).geometry,[input,roof]);
 const surroundings=useMemo(()=>geometry?solveSimpleCoverSurroundings(input,geometry.assembly,roof):null,[input,roof,geometry]);
 const brief=buildContactDesignBrief({input,roof,result:null,configuratorPrice:price});
 const finish=getRoofFinish(roof);
 if(!ready)return <main className={css.page}><p>Preparing your design…</p></main>;
 return <main className={css.page}>
 <header className={css.header}><span>Your pergola.</span><Link href="/configurator-preview?open=1" prefetch={false}>← Edit my design</Link></header>
 <div className={css.layout}>
 <section className={css.design} aria-label="Your design">
 <LightingProvider input={input} roof={roof} onChange={noop}><RailProvider><PreviewBlindProvider input={input} roof={roof} onChange={noop}>
 <div className={css.visual}>
 <div className={css.views} role="group" aria-label="Design view">{(['3D','Plan'] as const).map(item=><button key={item} aria-pressed={view===item} onClick={()=>setView(item)}>{item}</button>)}</div>
 {geometry?view==='3D'?<Scene covering={geometry.covering} scene={geometry.viewerScene} plan={geometry.plan} context={surroundings} activeDimension={null} interactive={false} reset={0} fit={0} onFallback={()=>setView('Plan')}/>:<div className={css.plan}><PreviewPlan readOnly roofPlanes={geometry.assembly.roofPlanes} covering={geometry.covering} plan={geometry.plan} context={null} activeDimension={null}/></div>:<p>Your design preview is unavailable. Your selections are still included.</p>}
 </div></PreviewBlindProvider></RailProvider></LightingProvider>
 <div className={css.total}><strong>{price?.status==='priced'?reviewMoney(price.amountIncGst):!price?'Updating estimate…':'Estimate to be confirmed'}</strong><p>Installed estimate · Including GST</p></div>
 <details className={css.details}><summary>View design details</summary>
 <dl className={css.specs}><div><dt>Size</dt><dd>{(input.widthMm/1000).toFixed(1)} × {(input.projectionMm/1000).toFixed(1)} m</dd></div><div><dt>Roof</dt><dd>{roof.family==='mono'?'Pitched':roof.family==='gable'?'Gable':'Box perimeter'} · {finish.material==='acrylic'?'Acrylic':finish.material==='solid'?'Solid with timber ceiling':'Combination'}</dd></div><div><dt>Sides</dt><dd>{(roof.sidePanels?.length??0)+(roof.blinds?.length??0)} selected</dd></div><div><dt>Lighting</dt><dd>{(roof.lighting?.rafterCount??0)+(roof.lighting?.cedarCount??0)} lights · {roof.lighting?.strips.length??0} LED strips</dd></div></dl>
 {price?.status==='priced'?<><h2>Price breakdown</h2><dl className={css.specs}>{customerPriceBreakdown(price.breakdown,!!roof.infills||!!roof.blinds?.some(blind=>blind.infill)).map((line,index)=><div key={index}><dt>{line.label}</dt><dd>{reviewMoney(line.amountIncGst)}</dd></div>)}</dl></>:<button onClick={retry}>Retry estimate</button>}
 <p className={css.note}>Subject to site confirmation. Foundations, unusual access or fixings, new electrical supply and travel are assessed separately.</p>
 </details></section>
 <ContactEnquiryForm initialEnquiryType="residential" initialContext={initialContext} configuredDesign={brief} compactConfigured/>
 </div></main>;
}
