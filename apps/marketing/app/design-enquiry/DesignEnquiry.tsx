'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import dynamic from 'next/dynamic';
import {usePreviewDraft} from '../../components/configurator-prototype/usePreviewDraft';
import {useConfiguratorPrice} from '../../components/configurator-prototype/useConfiguratorPrice';
import {useReviewPrice} from '../../components/configurator-prototype/useReviewPrice';
import {enquiryEstimate} from './enquiryEstimate';
import {enquiryReturnPath} from './enquiryReturnPath';
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
 const [attempt,setAttempt]=useState(0);
 const review=useReviewPrice(input,roof,ready,attempt);
 const estimate=enquiryEstimate(price,review,process.env.NODE_ENV==='development');
 const [view,setView]=useState<'3D'|'Plan'>('3D');
 const geometry=useMemo(()=>solvePergolaPreview(input,roof).geometry,[input,roof]);
 const surroundings=useMemo(()=>geometry?solveSimpleCoverSurroundings(input,geometry.assembly,roof):null,[input,roof,geometry]);
 const brief=buildContactDesignBrief({input,roof,result:null,configuratorPrice:price});
 const finish=getRoofFinish(roof);
 if(!ready)return <main className={css.page}><p>Preparing your design…</p></main>;
 return <main className={css.page}>
 <header className={css.header}>
 <Link className={css.brand} href="/" aria-label="Sanctuary Pergolas home">SANCTUARY PERGOLAS</Link>
 <Link className={css.back} href={enquiryReturnPath(initialContext.sourcePath)}>← Back to website</Link>
 </header>
 <div className={css.layout}>
 <section className={css.design} aria-label="Your design">
 <div className={css.designHeading}><h2>Your pergola.</h2><Link className={css.edit} href="/configurator-preview?open=1" prefetch={false}>← Edit my design</Link></div>
 <LightingProvider input={input} roof={roof} onChange={noop}><RailProvider><PreviewBlindProvider input={input} roof={roof} onChange={noop}>
 <div className={css.visual}>
 <div className={css.views} role="group" aria-label="Design view">{(['3D','Plan'] as const).map(item=><button key={item} aria-pressed={view===item} onClick={()=>setView(item)}>{item}</button>)}</div>
 {geometry?view==='3D'?<Scene covering={geometry.covering} scene={geometry.viewerScene} plan={geometry.plan} context={surroundings} activeDimension={null} interactive={false} reset={0} fit={0} onFallback={()=>setView('Plan')}/>:<div className={css.plan}><PreviewPlan readOnly roofPlanes={geometry.assembly.roofPlanes} covering={geometry.covering} plan={geometry.plan} context={null} activeDimension={null}/></div>:<p>Your design preview is unavailable. Your selections are still included.</p>}
 </div></PreviewBlindProvider></RailProvider></LightingProvider>
 <div className={css.total} aria-live="polite"><strong>{estimate.amount!==undefined?reviewMoney(estimate.amount):estimate.message}</strong><p>{estimate.draft?'Draft estimate · ':''}{estimate.excluded?.length?'Subtotal':'Installed estimate'} · Including GST</p></div>
 <details className={css.details}><summary>View design details</summary>
 <dl className={css.specs}><div><dt>Size</dt><dd>{(input.widthMm/1000).toFixed(1)} × {(input.projectionMm/1000).toFixed(1)} m</dd></div><div><dt>Roof</dt><dd>{roof.family==='mono'?'Pitched':roof.family==='gable'?'Gable':'Box perimeter'} · {finish.material==='acrylic'?'Acrylic':finish.material==='solid'?'Solid with timber ceiling':'Combination'}</dd></div><div><dt>Sides</dt><dd>{(roof.sidePanels?.length??0)+(roof.blinds?.length??0)} selected</dd></div><div><dt>Lighting</dt><dd>{(roof.lighting?.rafterCount??0)+(roof.lighting?.cedarCount??0)} lights · {roof.lighting?.strips.length??0} LED strips</dd></div></dl>
 {estimate.amount!==undefined?<><h2>Price breakdown</h2><dl className={css.specs}>{customerPriceBreakdown(estimate.breakdown,!!roof.infills||!!roof.blinds?.some(blind=>blind.infill)).map((line,index)=><div key={index}><dt>{line.label}</dt><dd>{reviewMoney(line.amountIncGst)}</dd></div>)}</dl>{!!estimate.excluded?.length&&<p>Not included yet: {estimate.excluded.join(', ')}.</p>}</>:estimate.retry?<button onClick={()=>{retry();setAttempt(value=>value+1);}}>Retry estimate</button>:null}
 <p className={css.note}>Subject to site confirmation. Foundations, unusual access or fixings, new electrical supply and travel are assessed separately.</p>
 </details></section>
 <ContactEnquiryForm initialEnquiryType="residential" initialContext={initialContext} configuredDesign={brief} compactConfigured/>
 </div></main>;
}
