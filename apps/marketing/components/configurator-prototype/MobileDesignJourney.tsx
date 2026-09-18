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
import MobileSideChoices from './MobileSideChoices';
import MobileSiteChoices from './MobileSiteChoices';
import MobileFootprint from './MobileFootprint';
import MobileDesignFinish from './MobileDesignFinish';
import type { PreviewSelection } from './ConfiguratorPrototype';
import MobileLightingChoices from './MobileLightingChoices';
import type { SharedEstimate } from './sharedEstimate';
import { hasLighting } from './lightingSelection';
import DesignFunnelTracker from './DesignFunnelTracker';
import css from './mobileJourney.module.css';
import styles from './prototype.module.css';

const PreviewViews = dynamic(() => import('./PreviewViews'), { ssr: false,
  loading: () => <p role="status">Preparing your pergola…</p> });
const titles: Record<MobileStep, string> = {
  shape: 'Find your shape.', roof: 'Light, shade, or both?', size: 'Make room for life.',
  explore: 'Your pergola, taking shape.', extras: 'Make it yours.',
  finished: 'Picture yourself here.', review: 'Your pergola.',
};
const nextLabels: Record<MobileStep, string> = {
  shape: 'Choose your roof', roof: 'Set your size', size: 'See your pergola', explore: 'Add sides & lighting',
  extras: 'See your finished design', finished: 'Review your design', review: '',
};
type Editor = 'details' | 'sides' | 'lighting' | null;

export default function MobileDesignJourney({ active, draft, pricePanel, estimate, selection }: {
  selection: PreviewSelection; active: boolean; draft: ReturnType<typeof usePreviewDraft>; pricePanel: ReactNode; estimate: SharedEstimate | null;
}) {
  const { input, roof, setInput, setRoof } = draft;
  const rail = useRail(), lighting = useLighting()!, blinds = usePreviewBlinds()!;
  const [step, setStep] = useState<MobileStep>(() => draft.linkNotice === 'loaded' ? 'review' : readMobileStep());
  const [editor, setEditor] = useState<Editor>(null);
  const sides = useMobileSides(roof, setRoof);
  const sidePhase = sides.phase;
  const [returnToReview, setReturnToReview] = useState(false);
  const [resetting, setResetting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null), scroll = useRef<HTMLDivElement>(null);
  const { activeDimension, showDimension } = usePreviewDimension();
  const index = MOBILE_STEPS.indexOf(step);
  const model = !editor && (step === 'explore' || step === 'finished');
  const editorModel = editor === 'lighting';
  const sideCount = (roof.blinds?.length ?? 0) + (roof.sidePanels?.length ?? 0);
  const lightCount = (roof.lighting?.rafterCount ?? 0) + (roof.lighting?.cedarCount ?? 0);


  useEffect(() => {
    saveMobileStep(step); retainPreviewDraft();
    scroll.current?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    // Mobile progress and the existing analytics/editor section have different granularity.
    rail.choose(editor === 'lighting' ? 'lighting' : editor === 'sides' ? 'sides' : editor === 'details' ? 'structure'
      : step === 'review' ? 'review' : step === 'roof' ? 'roof' : step === 'extras' ? 'personalise' : 'structure');
  // Choose is an event callback whose identity follows provider state.
  }, [step, editor, sidePhase]);
  useEffect(() => {
    if (draft.linkNotice === 'loaded') { setStep('review'); setEditor(null); }
  }, [draft.linkNotice]);

  useEffect(() => {
    if (blinds.editing && !editor) { sides.start([blinds.selected]); setEditor('sides'); }
  }, [blinds.editing, editor]);

  useEffect(() => {
    lighting.setView(editor === 'sides' && sidePhase === 'opening' ? 'Plan' : '3D');
    lighting.setNight(editor === 'lighting');

  }, [step, editor, sidePhase]);

  function go(next: MobileStep) {
    blinds.setEditing(false);
    setEditor(null); setStep(next);
    if (next === 'explore' || next === 'finished') {
      lighting.setView('3D');
      lighting.setNight(false);
    }
  }
  function done() {
    blinds.setEditing(false);
    setEditor(null);
    if (returnToReview) { setReturnToReview(false); go('review'); }
  }
  function edit(section: RailSection) {
    setReturnToReview(true);
    if (section === 'structure') go('size');
    else if (section === 'roof') go('roof');
    else if (section === 'lighting') setEditor('lighting');
    else { sides.start(); setEditor('sides'); }
  }
  function next() {
    if (editor === 'sides' && sidePhase === 'opening') sides.choose();
    else if (editor === 'sides' && sidePhase === 'finish') sides.apply();
    else if (editor) done();
    else if (returnToReview) { setReturnToReview(false); go('review'); }
    else go(MOBILE_STEPS[Math.min(index + 1, 6)]);
  }
  function back() {
    if (editor === 'sides' && sidePhase === 'preview') sides.start();
    else if (editor === 'sides' && sidePhase === 'finish') sides.setPhase('opening');
    else if (editor) done();
    else if (returnToReview) { setReturnToReview(false); go('review'); }
    else go(MOBILE_STEPS[Math.max(0, index - 1)]);
  }
  const openDetails = () => setEditor('details');

  return <div className={`${styles.page} ${css.journey}`} data-mobile-step={step} data-mobile-editor={editor ?? ''} data-night={lighting.night}>
    <DesignFunnelTracker active={active} ready={draft.ready} selectionKey={JSON.stringify({ input, roof })} section={rail.section} />
    <header className={css.heading}>
      <div className={css.progress}><span>{editor ? 'Refine your design' : `Step ${index + 1} of 7`}</span><span>{['Shape', 'Roof', 'Size', 'Explore', 'Personalise', 'Your pergola', 'Review'][index]}</span></div>
      <div className={css.progressTrack} aria-hidden="true">{MOBILE_STEPS.map((s, i) => <span key={s} data-complete={i <= index} />)}</div>
      <h1 tabIndex={-1} ref={heading}>{editor === 'details' ? 'More design options.' : editor === 'sides' ? sidePhase === 'opening' ? 'Where would you like privacy?' : sidePhase === 'finish' ? 'Find your balance.' : 'Your sides, together.' : editor === 'lighting' ? 'Stay a little longer.' : titles[step]}</h1>
      {model && <p className={css.modelIntro}>{step === 'explore' ? 'Drag to look around your space.' : `${(input.widthMm / 1000).toFixed(1)} × ${(input.projectionMm / 1000).toFixed(1)} m · ${sideCount ? `${sideCount} ${sideCount === 1 ? 'side' : 'sides'} personalised` : 'Open sides'}${hasLighting(lighting.value) ? ' · Ready for evenings' : ''}`}</p>}
    </header>
    <div ref={scroll} className={css.content} data-model={model}>
      {draft.linkNotice === 'invalid' && <p className={css.notice} role="status">This design link could not be opened. You can continue with the design below.</p>}
      {!draft.storageAvailable && <p className={css.notice} role="status">Your design cannot be saved for a refresh in this browser. Copy a design link from Review to keep it.</p>}
      {(model || editorModel) && <section className={css.model} data-full={model} data-editor={editorModel} data-size={!editor && step === 'size'} aria-label="Your pergola preview">
        <PreviewViews guided simple presentation onAddLighting={() => setEditor('lighting')} input={input} roof={roof} activeDimension={activeDimension} expanded={false} onToggleExpanded={() => {}} />
      </section>}
      {!editor && step === 'size' && <MobileFootprint input={input} roof={roof} activeDimension={activeDimension} />}
      {!editor && (step === 'shape' || step === 'roof') && <MobileRoofChoice kind={step} roof={roof} onChange={setRoof} />}
      {!editor && step === 'roof' && <details className={css.details}><summary>Refine your roof & ceiling</summary><RoofFinishChoices hideMaterial input={input} roof={roof} onChange={setRoof} /><RoofBattenControls roof={roof} onChange={setRoof} /></details>}
      {!editor && step === 'size' && <div className={`${css.controls} ${css.sizeControls}`}><PreviewControls mode="size" input={input} roof={roof} onChange={setInput} onRoofChange={setRoof} onDimensionActivity={showDimension} /><MobileSiteChoices input={input} roof={roof} setInput={setInput} setRoof={setRoof} /><p className={css.caption}>An approximate size is fine. We’ll confirm measurements for your home.</p>{returnToReview && <button className={css.textButton} onClick={() => go('shape')}>Change roof shape</button>}</div>}
      {model && (step === 'finished' ? <div className={css.modelActions}><button onClick={() => go('extras')}>Adjust sides & lighting</button><button onClick={openDetails}>More design options</button></div> : <button className={css.more} onClick={openDetails}>More design options <span aria-hidden="true">+</span></button>)}
      {!editor && step === 'extras' && <div className={css.extras}>
        <p>Keep it open, create some privacy, or add a warm glow. These choices are optional.</p>
        <button onClick={() => { sides.start(); setEditor('sides'); }}><span className={css.number}>01</span><span><strong>Sides & privacy</strong><small>Blinds, timber and aluminium screening</small><em>{sideCount ? `${sideCount} ${sideCount === 1 ? 'opening' : 'openings'} personalised` : 'Open sides'}</em></span><span aria-hidden="true"><ArrowUpRight /></span></button>
        <button onClick={() => setEditor('lighting')}><span className={css.number}>02</span><span><strong>Lighting</strong><small>For evenings spent outside</small><em>{lightCount} lights · {roof.lighting?.strips.length ?? 0} LED strips</em></span><span aria-hidden="true"><ArrowUpRight /></span></button>
        <p className={css.caption}>You can change any of these later.</p>
        {draft.selectionNotice && <p className={css.notice} role="status">{draft.selectionNotice}</p>}
      </div>}
      {editor === 'details' && <div className={css.controls}><p>Explore how your pergola could meet your home. We’ll confirm the connection and structural suitability for your site.</p><PreviewControls mode="details" input={input} roof={roof} onChange={setInput} onRoofChange={setRoof} onDimensionActivity={showDimension} /></div>}
      {editor === 'sides' && <MobileSideChoices flow={sides} roof={roof}><section className={css.model} aria-label="Your pergola preview"><PreviewViews guided simple presentation input={input} roof={roof} activeDimension={null} expanded={false} onToggleExpanded={() => {}} /></section></MobileSideChoices>}
      {editor === 'lighting' && <div className={css.controls}><MobileLightingChoices notice={draft.selectionNotice} onPreview={() => scroll.current?.scrollTo({ top: 0, behavior: 'instant' })} /></div>}
      <MobileDesignFinish visible={!editor && step === 'review'} selection={selection} pricePanel={pricePanel} estimate={estimate} onEdit={edit} onExplore={() => go('finished')} onDetails={openDetails} notice={draft.selectionNotice} />
      {!editor && step === 'review' && <div className={css.restart}>{resetting ? <><p>Replace this design and start again?</p><button onClick={() => { resetPreviewDraft(); setResetting(false); setReturnToReview(false); go('shape'); }}>Start new design</button><button onClick={() => setResetting(false)}>Keep this design</button></> : <button className={css.textButton} onClick={() => setResetting(true)}>Start a new design</button>}</div>}
    </div>
    <footer hidden={!editor && step === 'review'} className={css.footer} aria-label="Continue your design">
      <button className={css.back} disabled={!editor && index === 0 && !returnToReview} onClick={back}>{editor === 'sides' && sidePhase === 'preview' ? 'Choose more sides' : 'Back'}</button>
      <button className={css.next} disabled={editor === 'sides' && (sidePhase === 'opening' ? !sides.selected.length : sidePhase === 'finish' ? !sides.canApply : false)} onClick={next}>{editor === 'sides' && sidePhase === 'opening' ? 'Choose treatment' : editor === 'sides' && sidePhase === 'finish' ? `Apply to ${sides.selected.length} ${sides.selected.length === 1 ? 'opening' : 'openings'}` : editor ? (returnToReview ? 'Return to review' : 'Done') : returnToReview ? 'Return to review' : step === 'extras' && !sideCount && !hasLighting(lighting.value) ? 'Continue without extras' : nextLabels[step]}<span aria-hidden="true"><ArrowUpRight /></span></button>
    </footer>
  </div>;
}
