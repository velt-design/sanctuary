'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { SimpleCoverInput } from '../../lib/simpleCoverCalculator';
import { solvePergolaPreview, solveSimpleCoverSurroundings } from './solvePreview';
import type { PreviewRoofChoices } from './GableChoices';
import PreviewPlan from './PreviewPlan';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import styles from './prototype.module.css';

const PreviewScene = dynamic(() => import('./PreviewScene'), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Loading 3D view…</div>,
});

export default function PreviewViews({ input, roof, activeDimension, expanded, onToggleExpanded }: { input: SimpleCoverInput; roof: PreviewRoofChoices; activeDimension: PreviewDimensionAxis | null; expanded: boolean; onToggleExpanded: () => void }) {
  const [view, setView] = useState<'3D' | 'Plan'>('3D');
  const [reset, setReset] = useState(0);
  const [fit, setFit] = useState(0);
  const [surroundings, setSurroundings] = useState(true);
  const artifact = useMemo(() => solvePergolaPreview(input, roof), [input, roof]);
  const renderable = 'geometry' in artifact && artifact.geometry !== undefined;
  const context = useMemo(() => 'geometry' in artifact && artifact.geometry ? solveSimpleCoverSurroundings(input, artifact.geometry.assembly, roof) : null, [artifact, input, roof]);
  return <>
    <div className={styles.viewToolbar}>
      <div className={styles.viewTabs} role="group" aria-label="Choose view">{(['3D', 'Plan'] as const).map((name) =>
        <button key={name} aria-pressed={view === name} onClick={() => setView(name)}>{name}</button>)}</div>
      <div className={styles.viewActions}>
      {view === '3D' && renderable && <>
        <button aria-label="Fit view" title="Fit the pergola at your current angle" onClick={() => setFit(fit + 1)}>Fit</button>
        <button aria-label="Reset view" title="Return to the starting view" onClick={() => setReset(reset + 1)}>Reset</button>
      </>}
        <button className={styles.expandView} aria-label={expanded ? 'Close expanded view' : 'Expand view'} aria-expanded={expanded} onClick={onToggleExpanded}>{expanded ? 'Done' : 'Expand'} <span aria-hidden="true">{expanded ? '×' : '↗'}</span></button>
      </div>
    </div>
    <div className={styles.viewport} data-view={view} data-geometry-status={artifact.status}
      data-family={roof.family} data-ridge-direction={roof.family === 'box' ? 'parallel' : roof.orientation} data-gable-infills={roof.family === 'gable' && roof.infills}
      data-box-roof-mode={renderable && roof.family === 'box' ? artifact.geometry!.assembly.roofPlanes[0]?.metadata?.roofMode : undefined}
      data-infill-support-count={renderable ? artifact.geometry.assembly.members.filter(m => m.metadata?.frameRole === 'infill_support').length : 0}
      data-surroundings={surroundings} data-connection={input.connection} data-level={input.level}
      data-bracket-count={context?.brackets.length ?? 0}
      data-rafter-count={renderable ? artifact.geometry.plan.members.rafters.length : undefined}
      data-post-count={renderable ? artifact.geometry.plan.members.posts.length : undefined}>
      {renderable ? <>
        <div className={styles.sceneLayer} aria-hidden={view !== '3D'} style={{ visibility: view === '3D' ? 'visible' : 'hidden' }}>
          <PreviewScene scene={artifact.geometry.viewerScene} context={surroundings ? context : null} interactive={view === '3D'} activeDimension={activeDimension} plan={artifact.geometry.plan} reset={reset} fit={fit} onFallback={() => setView('Plan')} />
        </div>
        {view === 'Plan' && <PreviewPlan plan={artifact.geometry.plan} flashings={artifact.geometry.assembly.roofFlashings} context={surroundings ? context : null} activeDimension={activeDimension} />}
      </>
        : <div className={styles.loading} role="status">{artifact.messages[0]?.message || 'This design needs a closer look. Adjust your dimensions to continue.'}</div>}
    </div>
    <div className={styles.viewerFooter}><p className={styles.viewNote}>{view === '3D' ? <><span className={styles.mouseHint}>Drag to rotate · Scroll to zoom</span><span className={styles.touchHint}>Drag ↔ · Pinch to zoom</span></> : renderable
      ? <>{artifact.geometry.plan.members.rafters.length} rafters · {artifact.geometry.plan.members.posts.length} posts<span className={styles.desktopNote}> · Sized to your selections</span></>
      : 'Adjust your selections to preview the frame.'}
      {renderable && roof.family === 'box' && <span> · Internal {artifact.geometry.assembly.roofPlanes.length === 2 ? 'gable' : 'pitched'} roof</span>}</p>
      {renderable && <label className={styles.contextToggle}><input type="checkbox" checked={surroundings} onChange={(event) => setSurroundings(event.target.checked)} />Show surroundings</label>}
    </div>
  </>;
}
