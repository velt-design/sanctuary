'use client';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePreviewDraft, resetPreviewDraft, retainPreviewDraft } from './usePreviewDraft';
import { MOBILE_STEPS, readMobileStep, saveMobileStep, type MobileStep } from './mobileJourneyState';
import { usePreviewBlinds } from './PreviewBlindProvider';
import { useRail, type RailSection } from './RailProvider';
import { useLighting } from './LightingProvider';
import { usePreviewDimension } from './usePreviewDimension';
import MobileRoofChoice from './MobileRoofChoice';
import PreviewControls from './PreviewControls';
import RoofFinishChoices from './RoofFinishChoices';
import RoofBattenControls from './RoofBattenControls';
import { useMobileSides } from './useMobileSides';
import { useSideLookComparison } from './useSideLookComparison';
import MobileSideChoices from './MobileSideChoices';
import { useJourneyPosition } from './useJourneyPosition';
import { JourneyNightPresentation, useDayNightPresentation } from './useDayNightPresentation';

import MobileSizeStep from './MobileSizeStep';
import MobileSideLooks from './MobileSideLooks';
import MobileDesignEdit from './MobileDesignEdit';
import type { PreviewSelection } from './ConfiguratorPrototype';
import MobileLightingChoices from './MobileLightingChoices';
import MobileExtrasEstimate from './MobileExtrasEstimate';
import type { SharedEstimate } from './sharedEstimate';
import css from './mobileJourney.module.css';
import styles from './prototype.module.css';

const PreviewViews = dynamic(() => import('./PreviewViews'), { ssr: false,
  loading: () => <p role="status">Preparing your pergola…</p> });
const MobileDesignFinish = dynamic(() => import('./MobileDesignFinish'), { ssr: false,
  loading: () => <p role="status">Preparing your review…</p> });
const titles: Record<MobileStep, string> = {roof:'Find your roof.',size:'Make room for life.',extras:'Make it yours.',finished:'Picture yourself here.',review:'Your pergola.'};
const nextLabels: Record<MobileStep,string> = {roof:'Set your size',size:'Add sides & lighting',extras:'Review your design',finished:'Review your design',review:''};

export default function MobileDesignJourney({draft,pricePanel,estimate,selection,desktopSection}:{
  desktopSection?:RailSection;selection:PreviewSelection;draft:ReturnType<typeof usePreviewDraft>;pricePanel:(afterSummary?:ReactNode)=>ReactNode;estimate:SharedEstimate|null;
}) {
  const {input,roof,setInput,setRoof}=draft;
  // Also reconcile resumed/shared mobile designs and advanced editor changes.
  useEffect(()=>{
    if(roof.attachmentIntent==='freestanding' && input.level==='elevated') setInput({...input,level:'ground'});
  },[roof.attachmentIntent,input,setInput]);
  const rail=useRail(),lighting=useLighting()!,blinds=usePreviewBlinds()!;
  const [step,setStep]=useState<MobileStep>(()=>draft.linkNotice==='loaded'?'review':desktopSection?desktopSection==='review'?'review':desktopSection==='roof'?'roof':desktopSection==='structure'?'size':'extras':readMobileStep());
  const [reviewStarted,setReviewStarted]=useState(false);
  const [details,setDetails]=useState(false);
  const [editMenu,setEditMenu]=useState(() => draft.linkNotice === 'loaded' && new URLSearchParams(window.location.search).get('entry') === 'edit');
  const [extra,setExtra]=useState<'sides'|'lighting'>(desktopSection==='lighting'?'lighting':'sides');
  const [returnToReview,setReturnToReview]=useState(false);
  const [resetting,setResetting]=useState(false);
  const sides=useMobileSides(roof,setRoof);
  const comparison=useSideLookComparison(roof,blinds.openings,nextRoof=>{sides.start();setRoof(nextRoof);});
  const heading=useRef<HTMLHeadingElement>(null),scroll=useRef<HTMLDivElement>(null);
  const position=useJourneyPosition(editMenu?'edit':details?'details':step==='extras'?extra:step,scroll,heading);
  const {activeDimension,showDimension}=usePreviewDimension();
  const index=MOBILE_STEPS.indexOf(step==='finished'?'review':step);
  const model=!editMenu&&!details&&step==='finished';
  const night=!details&&step==='extras'&&extra==='lighting';
  const presentation=useDayNightPresentation(night,scroll);
  useEffect(()=>{if(step==='review'&&!editMenu)setReviewStarted(true);},[step,editMenu]);
  useEffect(()=>{
    saveMobileStep(step);retainPreviewDraft();
    if(!editMenu)rail.choose(details?'structure':step==='review'||step==='finished'?'review':step==='roof'?'roof':step==='extras'?extra:'structure');
  },[step,details,extra,editMenu]);
  useEffect(()=>{if(draft.linkNotice==='loaded'){setStep('review');setDetails(false);setEditMenu(new URLSearchParams(window.location.search).get('entry') === 'edit');}},[draft.linkNotice]);
  useEffect(()=>{if(blinds.editing&&step!=='extras'){sides.start([blinds.selected]);setStep('extras');setExtra('sides');}},[blinds.editing]);
  useEffect(()=>{lighting.setView('3D');lighting.setNight(night);},[step,night]);
  function go(next:MobileStep){setEditMenu(false);blinds.setEditing(false);setDetails(false);setStep(next);}
  function edit(section:RailSection){
    setReturnToReview(true);
    if(section==='structure')go('size');else if(section==='roof')go('roof');else {setExtra(section==='lighting'?'lighting':'sides');go('extras');}
  }
  function chooseEdit(){go('review');setReturnToReview(false);setEditMenu(true);}
  function next(){
    if(editMenu){go('review');return;}
    if(details){setDetails(false);if(returnToReview){setReturnToReview(false);go('review');}return;}
    if(returnToReview){setReturnToReview(false);go('review');return;}
    go(MOBILE_STEPS[Math.min(index+1,MOBILE_STEPS.length-1)]);
  }
  function back(){if(returnToReview){chooseEdit();return;}if(details){setDetails(false);return;}go(MOBILE_STEPS[Math.max(0,index-1)]);}
  return <JourneyNightPresentation.Provider value={presentation}><div className={`${styles.page} ${css.journey}`} data-mobile-step={step} data-mobile-editor={details?'details':night?'lighting':''} data-night={lighting.night}>
    <header className={css.heading}>
      <div className={css.progress}><span>{model?'Your model':editMenu||returnToReview?'Editing your design':details?'Refine your design':`Step ${index+1} of ${MOBILE_STEPS.length}`}</span><span>{editMenu ? 'Your choices' : ['Roof','Size','Sides & lighting','Review'][index]}</span></div>
      <div className={css.progressTrack} hidden={editMenu||returnToReview} aria-hidden="true">{MOBILE_STEPS.map((s,i)=><span key={s} data-complete={i<=index}/>)}</div>
      <h1 className={!editMenu&&!details&&step==='review'?css.reviewHeading:undefined} tabIndex={-1} ref={heading}>{editMenu?'Edit your design.':details?'More design options.':titles[step]}</h1>
    </header>
    <div ref={scroll} onScroll={position.remember} data-journey-content className={css.content} data-model={model}>
      {draft.linkNotice==='invalid'&&<p className={css.notice} role="status">This design link could not be opened. You can continue below.</p>}
      {!draft.storageAvailable&&<p className={css.notice} role="status">Copy a design link from Review to keep this design. This browser cannot save it for a refresh.</p>}
      {editMenu&&<MobileDesignEdit selection={selection} onEdit={edit} onDetails={()=>{setEditMenu(false);setReturnToReview(true);setDetails(true);}}/>}
      {!editMenu&&!details&&step==='roof'&&<>
        <MobileRoofChoice roof={roof} onChange={setRoof}/>
        <details className={css.details}><summary>Roof & ceiling details</summary>
          {roof.family==='gable'&&<fieldset className={css.segmented}><legend>Ridge direction</legend><div>{(['parallel','away'] as const).map(orientation=><label key={orientation} data-selected={roof.orientation===orientation}><input type="radio" name="mobile-ridge" checked={roof.orientation===orientation} onChange={()=>setRoof({...roof,orientation})}/>{orientation==='parallel'?'Parallel':'Extending'}</label>)}</div></fieldset>}
          <p className={css.caption}>Illustrative example.</p><RoofFinishChoices hideMaterial input={input} roof={roof} onChange={setRoof}/><RoofBattenControls roof={roof} onChange={setRoof}/></details>
      </>}
      {!details&&step==='size'&&<MobileSizeStep input={input} roof={roof} setInput={setInput} setRoof={setRoof} activeDimension={activeDimension} showDimension={showDimension}/>}
      {!details&&step==='extras'&&<>
        <div className={css.extraTabs} role="group" aria-label="Sides and lighting"><button aria-pressed={extra==='sides'} onClick={()=>setExtra('sides')}>Sides</button><button aria-pressed={extra==='lighting'} onClick={()=>setExtra('lighting')}>Lighting</button></div>
        {extra==='sides'&&draft.selectionNotice&&!draft.selectionNotice.includes('lights')&&<p className={css.notice} role="status">{draft.selectionNotice}</p>}
        {extra==='sides'?<MobileSideLooks roof={roof} comparison={comparison} estimate={<MobileExtrasEstimate price={selection.configuratorPrice}/>} preview={<PreviewViews guided simple presentation input={input} roof={roof} activeDimension={null} expanded={false} onToggleExpanded={()=>{}}/>}><MobileSideChoices flow={sides} roof={roof}/></MobileSideLooks>:
          <MobileLightingChoices notice={draft.selectionNotice} onPreview={()=>scroll.current?.scrollTo({top:0,behavior:'instant'})} estimate={<MobileExtrasEstimate price={selection.configuratorPrice}/>}
            preview={<section className={`${css.model} ${css.lightingModel}`} aria-label="Your pergola preview"><PreviewViews guided simple presentation input={input} roof={roof} activeDimension={null} expanded={false} onToggleExpanded={()=>{}}/></section>}/>
        }
      </>}
      {model&&<><section className={css.model} data-full="true" aria-label="Your pergola preview"><PreviewViews reviewSetting guided simple presentation input={input} roof={roof} activeDimension={activeDimension} expanded={false} onToggleExpanded={()=>{}}/></section><div className={css.modelActions}><button onClick={()=>go('extras')}>Adjust sides & lighting</button><button onClick={()=>setDetails(true)}>More design options</button></div></>}
      {details&&<div className={css.controls}><PreviewControls mode="details" input={input} roof={roof} onChange={setInput} onRoofChange={setRoof} onDimensionActivity={showDimension}/></div>}
      {(reviewStarted||(!editMenu&&step==='review'))&&<MobileDesignFinish visible={!editMenu&&!details&&step==='review'} selection={selection} pricePanel={pricePanel} estimate={estimate} onEdit={chooseEdit} onExplore={()=>{setReturnToReview(true);go('finished');}} notice={draft.selectionNotice}/>}
      {!editMenu&&!details&&step==='review'&&<div className={css.restart}>{resetting?<><p>Replace this design and start again?</p><button onClick={()=>{position.clear();comparison.clear();resetPreviewDraft();sides.start();setExtra('sides');setResetting(false);setReturnToReview(false);go('roof');}}>Start new design</button><button onClick={()=>setResetting(false)}>Keep this design</button></>:<button className={css.textButton} onClick={()=>setResetting(true)}>Start a new design</button>}</div>}
    </div>
    <footer hidden={!editMenu&&!details&&step==='review'} className={css.footer} aria-label="Continue your design">
      <button hidden={editMenu} className={css.back} disabled={!details&&index===0&&!returnToReview} onClick={back}>{returnToReview?'All sections':'Back'}</button>
      <button className={css.next} onClick={next}>{editMenu&&!reviewStarted?'Review your design':editMenu||returnToReview?'Return to review':details?'Done':nextLabels[step]}<span aria-hidden="true"><ArrowUpRight/></span></button>
    </footer>
  </div></JourneyNightPresentation.Provider>;
}
