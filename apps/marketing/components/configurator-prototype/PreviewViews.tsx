'use client';

import dynamic from 'next/dynamic';
import {useLighting} from './LightingProvider';
import { useMemo, useState } from 'react';
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

export default function PreviewViews({ input, roof, activeDimension, expanded, onToggleExpanded }: { input: SimpleCoverInput; roof: PreviewRoofChoices; activeDimension: PreviewDimensionAxis | null; expanded: boolean; onToggleExpanded: () => void }) {
  const blinds=usePreviewBlinds();
  const lighting=useLighting();
  const [selectedView, setView] = useState<'3D' | 'Plan'>('3D');
  const view=lighting?.editing?lighting.view:selectedView;
  const changeView=(v:'3D'|'Plan')=>lighting?.editing?lighting.setView(v):setView(v);
  const [reset, setReset] = useState(0);
  const [fit, setFit] = useState(0);
  const [surroundings, setSurroundings] = useState(true);
  const artifact = useMemo(() => solvePergolaPreview(input, roof), [input, roof]);
  const geometry = artifact.geometry;
  const covering = geometry?.covering;
  const renderable = geometry !== undefined;
  const context = useMemo(() => geometry ? solveSimpleCoverSurroundings(input, geometry.assembly, roof) : null, [geometry, input, roof]);
  return <>
    <div className={styles.viewToolbar}>
      <div className={styles.viewTabs} role="group" aria-label="Choose view">{(lighting?.editing ? ['Plan', '3D'] as const : ['3D', 'Plan'] as const).map((name) =>
        <button key={name} aria-pressed={view === name} onClick={() => changeView(name)}>{lighting?.editing ? name==='Plan'?'Lighting plan':'Preview in 3D' : name}</button>)}</div>
      <div className={styles.viewActions}>
      {blinds && !lighting?.editing && <button aria-label="Edit sides" aria-pressed={blinds.editing} onClick={()=>blinds.setEditing(!blinds.editing)}>Sides</button>}
      {view === '3D' && renderable && <>
        <button aria-label="Fit view" title="Fit the pergola at your current angle" onClick={() => setFit(fit + 1)}>Fit</button>
        <button aria-label="Reset view" title="Return to the starting view" onClick={() => { setReset(reset + 1); }}>Reset</button>
      </>}
        <button className={styles.expandView} aria-label={expanded ? 'Close expanded view' : 'Expand view'} aria-expanded={expanded} onClick={onToggleExpanded}>{expanded ? 'Done' : 'Expand'} <span aria-hidden="true">{expanded ? '×' : '↗'}</span></button>
      </div>
    </div>
    <div className={styles.viewport} data-view={view} data-light-strip-count={lighting?.value.strips.length??0} data-light-rafter-count={lighting?.value.rafterCount??0} data-light-cedar-count={lighting?.value.cedarCount??0} data-blind-count={blinds?.blinds.length??0} data-side-panel-count={blinds?.panels.length??0} data-geometry-status={artifact.status}
      data-roof-material={roof.finish?.material ?? "acrylic"} data-roof-profile={roof.finish?.profile} data-acrylic-bays={covering?.acrylicBays} data-family={roof.family} data-ridge-direction={roof.family === 'box' ? 'parallel' : roof.orientation} data-gable-infills={roof.family === 'gable' && roof.infills}
      data-box-roof-mode={renderable && roof.family === 'box' ? geometry!.assembly.roofPlanes[0]?.metadata?.roofMode : undefined}
      data-infill-support-count={renderable ? geometry.assembly.members.filter(m => m.metadata?.frameRole === 'infill_support').length : 0}
      data-surroundings={surroundings} data-connection={input.connection} data-level={input.level}
      data-bracket-count={context?.brackets.length ?? 0}
      data-rafter-count={renderable ? geometry.plan.members.rafters.length : undefined}
      data-post-count={renderable ? geometry.plan.members.posts.length : undefined}>
      {renderable ? <>
        <div className={styles.sceneLayer} aria-hidden={view !== '3D'} style={{ visibility: view === '3D' ? 'visible' : 'hidden' }}>
          <PreviewScene covering={covering} scene={geometry.viewerScene} context={surroundings ? context : null} interactive={view === '3D'} activeDimension={activeDimension} plan={geometry.plan} reset={reset} fit={fit} onFallback={() => changeView('Plan')} />
        </div>
        {view === 'Plan' && <PreviewPlan covering={covering} plan={geometry.plan} flashings={geometry.assembly.roofFlashings} context={surroundings ? context : null} activeDimension={activeDimension} />}
      </>
        : <div className={styles.loading} role="status">{artifact.messages[0]?.message || 'This design needs a closer look. Adjust your dimensions to continue.'}</div>}
    </div>
    <div className={styles.viewerFooter}><p className={styles.viewNote}>{view === '3D' ? <><span className={styles.mouseHint}>Drag to rotate · Scroll to zoom</span><span className={styles.touchHint}>Drag ↔ · Pinch to zoom</span></> : renderable
      ? lighting?.editing ? <>{lighting.tool==='strip'?'Tap beams or rafters to add LED strips · Gold means selected':lighting.tool==='rafter'?'Rafter lights are placed automatically':'Choose a lighting type to begin'}</> : <>{geometry.plan.members.rafters.length} rafters · {geometry.plan.members.posts.length} posts<span className={styles.desktopNote}> · Sized to your selections</span></>
      : 'Adjust your selections to preview the frame.'}
      {renderable && roof.family === 'box' && <span> · Internal {geometry.assembly.roofPlanes.length === 2 ? 'gable' : 'pitched'} roof</span>}</p>
      {renderable && !(lighting?.editing&&view==='Plan') && <label className={styles.contextToggle}><input type="checkbox" checked={surroundings} onChange={(event) => setSurroundings(event.target.checked)} />Show surroundings</label>}
    </div>
  </>;
}
