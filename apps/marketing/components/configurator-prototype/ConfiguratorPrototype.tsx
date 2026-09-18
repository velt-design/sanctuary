'use client';
import MobileDesignJourney from './MobileDesignJourney';
import { useMobileConfigurator } from './useMobileConfigurator';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';


import { useReviewPrice } from './useReviewPrice';
import ReviewPriceDisplay from './ReviewPriceDisplay';
import RailProvider, { useRail } from './RailProvider';
import DesignReview, {ReviewNextSteps} from './DesignReview';
import PersonaliseOverview, {PersonaliseSectionHeading} from './PersonaliseOverview';
import JourneyEstimate from './JourneyEstimate';
import ConfiguratorRail from './ConfiguratorRail';
import LightingProvider,{useLighting} from './LightingProvider';
import LightingControls from './LightingControls';
import { hasSimpleRoofPrice } from './roofFinish';
import dynamic from 'next/dynamic';
import { useEffect, useRef, type ReactNode } from 'react';
import type { RailSection } from './RailProvider';
import type { SimpleCoverInput, SimpleCoverPublicResult } from '../../lib/simpleCoverCalculator';
import type { PreviewRoofChoices } from './GableChoices';
import { simpleCoverAreaM2 } from '../../lib/simpleCoverCalculator';
import DimensionShortcut from './DimensionShortcut';
import PreviewControls from './PreviewControls';
import { usePreviewPrice } from './usePreviewPrice';
import { useConfiguratorPrice } from './useConfiguratorPrice';
import PublishedPriceDisplay from './PublishedPriceDisplay';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import { usePreviewDimension } from './usePreviewDimension';
import styles from './prototype.module.css';
import { usePreviewDraft } from './usePreviewDraft';
import PreviewNextAction from './PreviewNextAction';
import ShareDesign from './ShareDesign';
import { displayedEstimate, reopenedEstimateNotice } from './sharedEstimate';
import PreviewBlindProvider from './PreviewBlindProvider';
import journey from './journey.module.css';
import DesignFunnelTracker from './DesignFunnelTracker';

const PreviewViews = dynamic(() => import('./PreviewViews'), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Preparing your pergola…</div>,
});

export type PreviewSelection = { input: SimpleCoverInput; roof: PreviewRoofChoices; result: SimpleCoverPublicResult | null; configuratorPrice?: ConfiguratorPublicPrice | null };

export default function ConfiguratorPrototype({ active = true, expanded, onToggleExpanded, renderEnquiry, resume = false }: {
  active?: boolean;
  resume?: boolean; expanded: boolean; onToggleExpanded: () => void; renderEnquiry?: (selection: PreviewSelection) => ReactNode;
}) {
  const draft = usePreviewDraft();
  return <LightingProvider input={draft.input} roof={draft.roof} onChange={draft.setRoof}><RailProvider resume={resume}><ConfiguratorWorkspace active={active} draft={draft} expanded={expanded} onToggleExpanded={onToggleExpanded} renderEnquiry={renderEnquiry}/></RailProvider></LightingProvider>;
}
function ConfiguratorWorkspace({active,draft,expanded,onToggleExpanded,renderEnquiry}:{active:boolean;draft:ReturnType<typeof usePreviewDraft>;expanded:boolean;onToggleExpanded:()=>void;renderEnquiry?:(selection:PreviewSelection)=>ReactNode}){
  const {input,roof,setInput,setRoof,ready,storageAvailable,linkNotice,selectionNotice}=draft;
  const mobile = useMobileConfigurator();
  const lighting=useLighting()!;
  const rail=useRail();
  const desktopSection = useRef<RailSection | undefined>(undefined);
  useEffect(() => {
    // Ignore the server snapshot on initial phone hydration.
    if (ready && !mobile && !window.matchMedia('(max-width: 720px)').matches) desktopSection.current = rail.section;
  }, [ready, mobile, rail.section]);
  const lightingNotice = selectionNotice?.startsWith('Some lights no longer fit') ? 'Your roof change affected some lights. Check your lighting choices.' : undefined;
  const reviewPrice = useReviewPrice(input, roof, ready);
  const { price: configuratorPrice, retry: retryConfigured } = useConfiguratorPrice({ version: 1, input, roof }, ready);
  const { result, retry } = usePreviewPrice(input, ready && hasSimpleRoofPrice(roof) && configuratorPrice?.status === 'disabled');
  const estimate = displayedEstimate(hasSimpleRoofPrice(roof) ? result : null, process.env.NODE_ENV === 'development' ? reviewPrice : undefined, configuratorPrice);
  const { activeDimension, showDimension } = usePreviewDimension();
  if (!ready) return <div className={styles.loading} role="status">Preparing your design…</div>;
  const pricePanel = <section id="configurator-price-breakdown" tabIndex={-1} className={styles.price} aria-label="Estimated price" aria-live="polite" aria-atomic="true">
          {(!mobile || renderEnquiry) && <p className={styles.eyebrow}>{roof.family === 'gable' ? 'YOUR GABLE PERGOLA' : roof.family === 'box' ? 'YOUR BOX PERIMETER PERGOLA' : 'YOUR PITCHED PERGOLA'}</p>}
          {configuratorPrice?.status !== 'disabled' ? <PublishedPriceDisplay value={configuratorPrice} retry={retryConfigured} hasInfills={!!(roof.family==='gable'&&roof.infills)||!!roof.blinds?.some(blind=>blind.infill)}/> : process.env.NODE_ENV === 'development' ? <ReviewPriceDisplay value={reviewPrice} expanded={mobile && !renderEnquiry}/> : !hasSimpleRoofPrice(roof) ? <><p className={styles.priceValue}>Your pergola, taking shape.</p><p className={styles.small}>Explore the design here. Your selected roof pricing will be confirmed by Sanctuary.</p></> : !result ? <p className={styles.priceValue}>Updating estimate…</p> : result.status === 'priced'
            ? <><p className={styles.priceValue}><span>From </span>{new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(result.price.fromIncGst)}</p><p className={styles.small}>Including GST · Subject to site confirmation</p></>
            : result.status === 'custom' ? <><p className={styles.priceValue}>A custom fit.</p><p className={styles.small}>{result.reason}</p></>
            : <><p>Estimate unavailable. Keep exploring your design.</p><button className={styles.textButton} onClick={retry}>Retry estimate <ArrowUpRight /></button></>}
        </section>;
  return <PreviewBlindProvider input={input} roof={roof} onChange={setRoof}>{mobile && !renderEnquiry ? <MobileDesignJourney desktopSection={desktopSection.current} selection={{input,roof,result,configuratorPrice}} active={active} draft={draft} pricePanel={pricePanel} estimate={estimate} /> : <div className={styles.page} data-lighting-edit={lighting.editing} data-night={lighting.night} data-expanded={expanded} data-layout={renderEnquiry ? 'project' : 'popup'}>
    <DesignFunnelTracker active={active} ready={ready} selectionKey={JSON.stringify({input,roof})} section={rail.section}/>
    <div className={styles.workspace}>
      <div className={styles.visualSlot}>
      <section className={styles.visual} aria-label="Pergola views" data-expanded={expanded}>
        <PreviewViews input={input} roof={roof} activeDimension={activeDimension} expanded={expanded} onToggleExpanded={onToggleExpanded} />
        <div className={styles.specStrip}><DimensionShortcut axis="width" value={input.widthMm}/><DimensionShortcut axis="projection" value={input.projectionMm}/><span><strong>{simpleCoverAreaM2(input).toFixed(1)} m²</strong> covered space</span><div className={journey.desktopEstimate}><JourneyEstimate retry={retryConfigured} selection={{input,roof,result,configuratorPrice}} reviewPrice={process.env.NODE_ENV === 'development' ? reviewPrice : undefined}/></div></div>
      </section>
      </div>
      <div className={styles.choicesColumn}>
      <aside className={styles.sidebar} aria-label="Your pergola choices">
        <ConfiguratorRail/>
        <PersonaliseSectionHeading/>
        {selectionNotice && !lightingNotice && <p className={styles.inputNotice} role="status">{selectionNotice}</p>}
        {lightingNotice && rail.section==='lighting' && <p className={journey.selectionNote} role="status">{lightingNotice}</p>}
        {renderEnquiry && <div id="project-design" />}
        {linkNotice && <p className={styles.storageNotice} role="status">{linkNotice === 'loaded' ? reopenedEstimateNotice(draft.sharedEstimate, estimate) : 'This design link could not be opened. You can continue designing below.'}</p>}
        {rail.section==='personalise'?<PersonaliseOverview roof={roof} lightingNotice={lightingNotice}/>:rail.section==='review'?<DesignReview input={input} roof={roof} lightingNotice={lightingNotice}/>:lighting.editing?<LightingControls onPreview={()=>{if(window.matchMedia('(max-width: 720px)').matches&&!expanded)onToggleExpanded();}}/>:<><PreviewControls input={input} roof={roof} onRoofChange={setRoof} onChange={setInput} onDimensionActivity={showDimension} />
        </>}
        <div hidden={rail.section!=='review'}>

        {pricePanel}
        <ReviewNextSteps/>
        {!renderEnquiry && <div className={journey.mobileReviewTools}><button className={styles.textButton} onClick={()=>rail.choose('personalise')}>Back to Personalise</button><ShareDesign draft={{version:1,input,roof}} estimate={estimate}/></div>}
        {!storageAvailable && <p className={styles.storageNotice} role="status">Your design is available as you move between these previews, but cannot be saved for a page refresh in this browser.</p>}
        {renderEnquiry && <div className={journey.projectShare}><ShareDesign draft={{ version: 1, input, roof }} estimate={estimate} /></div>}
        {renderEnquiry?.({ input, roof, result, configuratorPrice })}
        <footer className={styles.footnote}><span>CONCEPT PREVIEW</span><p>Frame dimensions follow your selections. Framing and supports are representative. Sanctuary will confirm roof detailing, structural suitability and site connections.</p></footer>
        </div>
      </aside>
      {!renderEnquiry && <PreviewNextAction retry={retryConfigured} selection={{ input, roof, result, configuratorPrice }} reviewPrice={process.env.NODE_ENV === 'development' ? reviewPrice : undefined} />}
      </div>
    </div>
  </div>}</PreviewBlindProvider>;
}
