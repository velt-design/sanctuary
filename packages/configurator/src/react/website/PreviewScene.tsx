'use client';

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SceneCanvas as Canvas } from '@sp/geometry-viewer/react/canvas';
import { useThree } from '@react-three/fiber';
import PreviewCamera from './PreviewCamera';
import SceneReady, { SceneFallbackReady } from './SceneReady';
import PreviewProductNode from './PreviewProductNode';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { RoofFinishGeometry } from '@sp/geometry';
import {useLighting} from './LightingProvider';
import PreviewLighting from './PreviewLighting';
import DayNightTransition from './DayNightTransition';
import type { NightPresentation } from './nightPresentation';
import SceneSnapshot from './SceneSnapshot';
import FreestandingBase from './FreestandingBase';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import type { GeometryPlanViewModel, ViewerSceneModel, RepresentativeSurroundings } from '@sp/geometry';
import { StudioTreatment, StudioQuality } from './StudioTreatment';
import { RealismStudy } from './RealismStudy';
import PreviewPerformanceEvidence from './PreviewPerformanceEvidence';
import { SceneRenderingUpgrade } from './SceneRenderingUpgrade';
import SceneBenchmark from './SceneBenchmark';




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

export default function PreviewScene({ enhanced = false, eyeLevel = false, realism = false, fitPadding = 1, framingKey, choiceView, reviewSetting = false, nightPresentation, showReferenceBase = true, covering, scene, plan, context, activeDimension, interactive, reset, fit, onFallback, presentation = false, onCapture, onReady, loadingClassName, renderContext, renderDimension }: {
  enhanced?: boolean; eyeLevel?: boolean; realism?: boolean;
  fitPadding?: number;
  onReady?: () => void;
  loadingClassName?: string;
  renderContext?: (args: { reducedDetail: boolean; bounds: ReturnType<typeof computeSceneBoundsFromPoints>; fitPoints: import('@sp/geometry').Point3[] }) => ReactNode;
  renderDimension?: (roof: import('@sp/geometry').Point3[]) => ReactNode;
  framingKey?: string; choiceView?: 'sides' | 'lighting';
  reviewSetting?: boolean; nightPresentation: NightPresentation; presentation?: boolean; onCapture?: (image: string) => void;
  showReferenceBase?: boolean; covering?: RoofFinishGeometry; context: RepresentativeSurroundings | null;
  scene: ViewerSceneModel; plan: GeometryPlanViewModel; activeDimension: 'width' | 'projection' | null;
  interactive: boolean; reset: number; fit: number; onFallback: () => void;
}) {
  const studio = true;
  const lighting=useLighting();
  const blindWorkspace=usePreviewBlinds();
  const [unavailable, setUnavailable] = useState(false);
  const [mobile] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width:760px)').matches);
  const [reducedDetail,setReducedDetail]=useState(mobile);
  const [attempt,setAttempt]=useState(0);
  const fallback = <div className={loadingClassName}><p>The 3D view paused. Your selections are still here.</p><button onClick={()=>{setUnavailable(false);setAttempt(value=>value+1);}}>Try 3D again</button><button onClick={onFallback}>View your plan</button></div>;
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
      aria-label="Interactive 3D pergola preview" fallback={<span aria-hidden="true">Pergola model</span>}>
      <SceneReady onReady={onReady}/><ContextWatch onFallback={() => { setUnavailable(true); onFallback(); }} />
      <DayNightTransition presentation={nightPresentation}>
      <StudioTreatment.Provider value={studio}>
      <RealismStudy.Provider value={realism}>
      <SceneRenderingUpgrade.Provider value={enhanced}>
      {process.env.NODE_ENV === 'development' && <SceneBenchmark bounds={bounds}/> }
      {process.env.NODE_ENV === 'development' && <PreviewPerformanceEvidence/>}
      <PreviewLighting realism={realism} reducedDetail={mobile} studio={studio} review={studio && reviewSetting}/>
      {studio&&<StudioQuality onReducedDetail={setReducedDetail} revision={JSON.stringify({reviewSetting,reducedDetail,objects,covering,blinds:blindWorkspace?.blinds,panels:blindWorkspace?.panels})}/> }
      <PreviewProductNode scene={scene} covering={covering} choiceView={choiceView} reviewSetting={reviewSetting}/>
      {showReferenceBase && plan.connectionType === 'freestanding' && <FreestandingBase plan={plan} />}
      {renderContext?.({ reducedDetail, bounds, fitPoints })}
      <PreviewCamera enhanced={enhanced} orbitTarget={enhanced ? bounds.center : undefined} eyeLevel={eyeLevel} groundZ={context?.architecture.terrace.max.z ?? bounds.min.z} fitPadding={fitPadding} framingKey={framingKey} choiceView={choiceView} explore={reviewSetting && !onCapture} portrait={Boolean(onCapture)} studio={studio} bounds={choiceView === 'lighting' ? bounds : cameraBounds} fitPoints={cameraPoints} enabled={interactive} reset={reset} fit={fit} surroundings={showReferenceBase && Boolean(context)} presentation={presentation} side={choiceView !== 'lighting' && presentation && blindWorkspace?.editing ? blindWorkspace.openings.find(o => o.id === blindWorkspace.selected)?.side : undefined} />
      {interactive && activeDimension && roof.length > 0 && renderDimension?.(roof)}
      {onCapture && <SceneSnapshot night={lighting?.night ?? false} onCapture={onCapture} />}
      </SceneRenderingUpgrade.Provider>
      </RealismStudy.Provider>
      </StudioTreatment.Provider>
    </DayNightTransition>
    </Canvas>
  </SceneBoundary>;
}
