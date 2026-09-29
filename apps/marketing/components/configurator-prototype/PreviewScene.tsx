'use client';

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import PreviewCamera from './PreviewCamera';
import SceneReady, { SceneFallbackReady } from './SceneReady';
import PreviewBlinds from './PreviewBlinds';
import { usePreviewBlinds } from './PreviewBlindProvider';
import PreviewRoof from './PreviewRoof';
import PreviewRoofFinish from './PreviewRoofFinish';
import type { RoofFinishGeometry } from '@sp/geometry';
import {useLighting} from './LightingProvider';
import PergolaLightFixtures from './PergolaLightFixtures';
import PreviewLighting from './PreviewLighting';
import DayNightTransition from './DayNightTransition';
import type { NightPresentation } from './useDayNightPresentation';
import SceneSnapshot from './SceneSnapshot';
import PreviewDimensionGuide from './PreviewDimensionGuide';
import PreviewSurroundings from './PreviewSurroundings';
import FreestandingBase from './FreestandingBase';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import { SceneObjectNode } from '@sp/geometry-viewer/react';
import type { GeometryPlanViewModel, ViewerSceneModel, RepresentativeSurroundings } from '@sp/geometry';
import styles from './prototype.module.css';
import { StudioTreatment, StudioQuality } from './StudioTreatment';
import StudioSetting from './StudioSetting';


const noop = () => {};

function ContextWatch({ onFallback }: { onFallback: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onFallback);
    return () => canvas.removeEventListener('webglcontextlost', onFallback);
  }, [gl, onFallback]);
  return null;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function PreviewScene({ framingKey, choiceView, reviewSetting = false, nightPresentation, showReferenceBase = true, covering, scene, plan, context, activeDimension, interactive, reset, fit, onFallback, presentation = false, onCapture, onReady }: {
  onReady?: () => void;
  framingKey?: string; choiceView?: 'sides' | 'lighting';
  reviewSetting?: boolean; nightPresentation: NightPresentation; presentation?: boolean; onCapture?: (image: string) => void;
  showReferenceBase?: boolean; covering?: RoofFinishGeometry; context: RepresentativeSurroundings | null;
  scene: ViewerSceneModel; plan: GeometryPlanViewModel; activeDimension: PreviewDimensionAxis | null;
  interactive: boolean; reset: number; fit: number; onFallback: () => void;
}) {
  const studio = true;
  const lighting=useLighting();
  const blindWorkspace=usePreviewBlinds();
  const [unavailable, setUnavailable] = useState(false);
  const [mobile] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width:760px)').matches);
  const [reducedDetail,setReducedDetail]=useState(mobile);
  const [attempt,setAttempt]=useState(0);
  const fallback = <div className={styles.loading}><p>The 3D view paused. Your selections are still here.</p><button onClick={()=>{setUnavailable(false);setAttempt(value=>value+1);}}>Try 3D again</button><button onClick={onFallback}>View your plan</button></div>;
  // Context is a separate package-owned visual reference. Camera framing stays
  // centred on the pergola rather than zooming out to fit a two-storey house.
  const objects = useMemo(() => scene.layers.filter((layer) => layer.visibleByDefault).flatMap((layer) => layer.objects)
    .filter((object) => !(covering && object.type === 'roof_plane') && !object.type.startsWith('house_') && !object.type.startsWith('reference_') && (object.type !== 'roof_flashing' || object.metadata?.representativeGableRidge)), [scene, covering]);
  const fitPoints = useMemo(() => objects.flatMap((object) => object.type === 'member_prism'
    ? [object.centerline.start, object.centerline.end]
    : object.type === 'roof_plane' || object.type === 'roof_cladding_panel' ? object.boundary : []), [objects]);
  const bounds = useMemo(() => computeSceneBoundsFromPoints(fitPoints), [fitPoints]);
  // Fit first-floor supports without zooming out to fit the entire house.
  const cameraPoints = useMemo(() => context?.elevated ? [...fitPoints,
    ...context.architecture.supports.flatMap(support => [support.min, support.max])] : fitPoints, [fitPoints, context]);
  const cameraBounds = useMemo(() => computeSceneBoundsFromPoints(cameraPoints), [cameraPoints]);
  const roof = useMemo(() => scene.layers.flatMap((layer) => layer.objects).flatMap(object => object.type === 'roof_plane' ? object.boundary : []), [scene]);
  const readyFallback = <><SceneFallbackReady onReady={onReady}/>{fallback}</>;
  if (unavailable) return readyFallback;
  return <SceneBoundary key={attempt} fallback={readyFallback}>
    <Canvas shadows={studio ? 'percentage' : false} frameloop="demand" dpr={[1, mobile ? 1.25 : 1.75]} style={{ touchAction: 'pan-y' }}
      camera={{ position: [12000, -18000, 12000], up: [0, 0, 1], fov: 24, near: 10, far: 200000 }}
      fallback={fallback}>
      <SceneReady onReady={onReady}/><ContextWatch onFallback={() => { setUnavailable(true); onFallback(); }} />
      <DayNightTransition presentation={nightPresentation}>
      <StudioTreatment.Provider value={studio}>
      <PreviewLighting reducedDetail={mobile} studio={studio} review={studio && reviewSetting}/>
      {studio&&<StudioQuality onReducedDetail={setReducedDetail} revision={JSON.stringify({reviewSetting,reducedDetail,objects,covering,blinds:blindWorkspace?.blinds,panels:blindWorkspace?.panels})}/> }
      {lighting&&<PergolaLightFixtures/>}
      {blindWorkspace && <PreviewBlinds workspace={lighting?.editing || choiceView === 'lighting'?{...blindWorkspace,editing:false,select:noop}:choiceView === 'sides'?{...blindWorkspace,select:noop}:blindWorkspace} />}
      {covering && <PreviewRoofFinish covering={covering} review={studio && reviewSetting} />}
      {showReferenceBase && plan.connectionType === 'freestanding' && <FreestandingBase plan={plan} />}
      {context && <PreviewSurroundings reducedDetail={studio&&reducedDetail} richSetting={studio && reviewSetting} studio={studio} context={context} bounds={bounds} productPoints={fitPoints} />}
      {studio&&reviewSetting&&showReferenceBase&&<StudioSetting plan={plan} context={context}/>}
      <PreviewCamera framingKey={framingKey} choiceView={choiceView} explore={reviewSetting && !onCapture} portrait={Boolean(onCapture)} studio={studio} bounds={choiceView === 'lighting' ? bounds : cameraBounds} fitPoints={cameraPoints} enabled={interactive} reset={reset} fit={fit} surroundings={Boolean(context)} presentation={presentation} side={choiceView !== 'lighting' && presentation && blindWorkspace?.editing ? blindWorkspace.openings.find(o => o.id === blindWorkspace.selected)?.side : undefined} />
      <group>{objects.map((object) => object.type === 'roof_plane' || object.type === 'roof_cladding_panel'
        ? <PreviewRoof key={object.id} object={object} />
        : <SceneObjectNode key={object.id} object={object} color="#242824" memberAppearance={{ roughness: studio ? .28 : .38, metalness: studio ? .35 : .2, envMapIntensity: studio ? 1.1 : .8 }}
          selected={false} hovered={false} onSelect={noop} onHoverEnter={noop} onHoverLeave={noop} onFocus={noop} clippingPlanes={[]} />)}</group>
      {interactive && activeDimension && roof.length > 0 && <PreviewDimensionGuide axis={activeDimension} plan={plan} roof={roof} />}
      {onCapture && <SceneSnapshot night={lighting?.night ?? false} onCapture={onCapture} />}
      </StudioTreatment.Provider>
    </DayNightTransition>
    </Canvas>
  </SceneBoundary>;
}
