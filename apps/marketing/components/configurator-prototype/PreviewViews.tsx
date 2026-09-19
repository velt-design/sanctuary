'use client';
import ArrowUpRight from '../marketing-foundation/ArrowUpRight';
import { useMobileConfigurator } from './useMobileConfigurator';


import dynamic from 'next/dynamic';
import {useRail} from './RailProvider';
import {useLighting} from './LightingProvider';
import {hasLighting} from './lightingSelection';
import { useMemo, useRef, useState } from 'react';
import { useDayNightPresentation } from './useDayNightPresentation';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { solvePergolaPreview, solveSimpleCoverSurroundings } from './solvePreview';
import type { PreviewRoofChoices } from './GableChoices';
import PreviewPlan from './PreviewPlan';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import styles from './prototype.module.css';

const PreviewScene = dynamic(() => import('./PreviewScene'), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Loading 3D view…</div>,
});

export default function PreviewViews({ input, roof, activeDimension, expanded, onToggleExpanded, guided = false, presentation = false, simple = false, onAddLighting, onCapture, reviewSetting = false }: { reviewSetting?: boolean; onCapture?: (image: string) => void; simple?: boolean; presentation?: boolean; guided?: boolean; onAddLighting?: () => void; input: SimpleCoverInput; roof: PreviewRoofChoices; activeDimension: PreviewDimensionAxis | null; expanded: boolean; onToggleExpanded: () => void }) {
  const blinds=usePreviewBlinds();
  const mobile = useMobileConfigurator();
  const rail=useRail();
  const lighting=useLighting();
  const viewport = useRef<HTMLDivElement>(null);
  const nightPresentation = useDayNightPresentation(lighting?.night ?? false, viewport, Boolean(onCapture));
  const [selectedView, setView] = useState<'3D' | 'Plan'>('3D');
  const view=lighting?.view??selectedView;
  const changeView=(v:'3D'|'Plan')=>lighting?lighting.setView(v):setView(v);
  const [surroundings, setSurroundings] = useState(true);
  const artifact = useMemo(() => solvePergolaPreview(input, roof), [input, roof]);
  const geometry = artifact.geometry;
  const covering = geometry?.covering;
  const renderable = geometry !== undefined;
  const context = useMemo(() => geometry ? solveSimpleCoverSurroundings(input, geometry.assembly, roof) : null, [geometry, input, roof]);
  return <>
    {!simple && <div className={styles.viewToolbar}>
      <div className={styles.viewTabs} role="group" aria-label="Choose view">{(['3D', 'Plan'] as const).map((name) =>
        <button key={name} aria-pressed={view === name} onClick={() => changeView(name)}>{name}</button>)}</div>
      {lighting && (view === 'Plan' ? <div className={styles.timeTabs}><button onClick={() => { lighting.setNight(hasLighting(lighting.value)); changeView('3D'); }}>{hasLighting(lighting.value) ? 'Preview lighting in 3D' : 'Preview in 3D'} <ArrowUpRight /></button></div> : <div className={styles.timeTabs} role="group" aria-label="Time of day">{[false,true].map(n => <button key={String(n)} aria-pressed={lighting.night===n} onClick={()=>lighting.setNight(n)}>{n?'Night':'Day'}</button>)}</div>)}
      {!guided && <div className={styles.viewActions}>
        <button className={styles.expandView} aria-label={expanded ? 'Close expanded view' : 'Expand view'} aria-expanded={expanded} onClick={onToggleExpanded}>{expanded ? 'Done' : 'Expand'} <span aria-hidden="true">{expanded ? '×' : <ArrowUpRight />}</span></button>
      </div>}
    </div>}
    <div ref={viewport} className={styles.viewport} data-view={view} data-light-strip-count={lighting?.value.strips.length??0} data-light-rafter-count={lighting?.value.rafterCount??0} data-light-cedar-count={lighting?.value.cedarCount??0} data-blind-count={blinds?.blinds.length??0} data-side-panel-count={blinds?.panels.length??0} data-geometry-status={artifact.status}
      data-roof-material={roof.finish?.material ?? "acrylic"} data-roof-profile={roof.finish?.profile} data-acrylic-bays={covering?.acrylicBays} data-family={roof.family} data-ridge-direction={roof.family === 'box' ? 'parallel' : roof.orientation} data-gable-infills={roof.family === 'gable' && roof.infills}
      data-box-roof-mode={renderable && roof.family === 'box' ? geometry!.assembly.roofPlanes[0]?.metadata?.roofMode : undefined}
      data-infill-support-count={renderable ? geometry.assembly.members.filter(m => m.metadata?.frameRole === 'infill_support').length : 0}
      data-surroundings={surroundings} data-connection={input.connection} data-level={input.level}
      data-bracket-count={context?.brackets.length ?? 0}
      data-rafter-count={renderable ? geometry.plan.members.rafters.length : undefined}
      data-post-count={renderable ? geometry.plan.members.posts.length : undefined}>
      {renderable ? <>
        <div className={styles.sceneLayer} aria-hidden={view !== '3D'} style={{ visibility: view === '3D' ? 'visible' : 'hidden' }}>
          <PreviewScene reviewSetting={reviewSetting} nightPresentation={nightPresentation} showReferenceBase={surroundings} covering={covering} scene={geometry.viewerScene} context={surroundings ? context : null} interactive={view === '3D' && !onCapture} activeDimension={activeDimension} plan={geometry.plan} reset={0} fit={0} presentation={presentation} onCapture={onCapture} onFallback={() => changeView('Plan')} />
        </div>
        {view === 'Plan' && <PreviewPlan guidedOpenings={guided && simple && rail.section === 'sides'} profile={roof.finish?.profile} trayWidth={roof.finish?.trayWidth} roofPlanes={geometry.assembly.roofPlanes} covering={covering} plan={geometry.plan} flashings={geometry.assembly.roofFlashings} context={surroundings ? context : null} activeDimension={activeDimension} />}
      </>
        : <div className={styles.loading} role="status">{artifact.messages[0]?.message || 'This design needs a closer look. Adjust your dimensions to continue.'}</div>}
    {reviewSetting&&(mobile||(process.env.NODE_ENV==='development'&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('render')==='studio'))&&<span style={{position:'absolute',bottom:8,right:10,fontSize:10,color:'var(--color-text-secondary)',pointerEvents:'none'}}>Setting & furniture illustrative</span>}
    {!simple&&lighting?.night&&!hasLighting(lighting.value)&&<div className={styles.nightPrompt}>Your design has no lights yet. <button onClick={()=>{if(onAddLighting)onAddLighting();else lighting.open();if(expanded&&window.matchMedia('(max-width: 720px)').matches)onToggleExpanded();}}>Add lighting</button></div>}
    </div>
    {!simple && <div className={styles.viewerFooter}><p className={styles.viewNote}>{view === '3D' ? <><span className={styles.mouseHint}>Drag to rotate · Scroll to zoom</span><span className={styles.touchHint}>Drag ↔ · Pinch to zoom</span></> : renderable
      ? lighting?.editing ? <>{lighting.tool==='strip'?'Tap beams or rafters to add LED strips · Gold means selected':lighting.tool==='rafter'?'Rafter lights are placed automatically':lighting.tool==='cedar'?'Cedar lights are centred between rafters':'Your lighting layout'}</> : guided ? <>Your footprint · dimensions in metres</> : rail.section==='roof' ? <>Roof plan · looking down from above</> : <>Hover or tap a side to edit<span className={styles.desktopNote}> · {geometry.plan.members.posts.length} posts</span></>
      : 'Adjust your selections to preview the frame.'}
      {renderable && roof.family === 'box' && <span> · Internal {geometry.assembly.roofPlanes.length === 2 ? 'gable' : 'pitched'} roof</span>}</p>
      {renderable && !(lighting?.editing&&view==='Plan') && (presentation ? <details><summary>View options</summary><label className={styles.contextToggle}><input type="checkbox" checked={surroundings} onChange={(event) => setSurroundings(event.target.checked)} />Show surroundings</label></details> : <label className={styles.contextToggle}><input type="checkbox" checked={surroundings} onChange={(event) => setSurroundings(event.target.checked)} />Show surroundings</label>)}
    </div>}
  </>;
}
