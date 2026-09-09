'use client';

import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import PreviewCamera from './PreviewCamera';
import PreviewRoof from './PreviewRoof';
import PreviewRoofFinish from './PreviewRoofFinish';
import type { RoofFinishGeometry } from '@sp/geometry';
import PreviewLighting from './PreviewLighting';
import PreviewDimensionGuide from './PreviewDimensionGuide';
import PreviewSurroundings from './PreviewSurroundings';
import type { PreviewDimensionAxis } from './usePreviewDimension';
import { computeSceneBoundsFromPoints } from '@sp/geometry-viewer';
import { SceneObjectNode } from '@sp/geometry-viewer/react';
import type { GeometryPlanViewModel, ViewerSceneModel, RepresentativeSurroundings } from '@sp/geometry';
import styles from './prototype.module.css';

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

export default function PreviewScene({ ceilingView = false, under = 0, covering, scene, plan, context, activeDimension, interactive, reset, fit, onFallback }: {
  ceilingView?: boolean; under?: number; covering?: RoofFinishGeometry; context: RepresentativeSurroundings | null;
  scene: ViewerSceneModel; plan: GeometryPlanViewModel; activeDimension: PreviewDimensionAxis | null;
  interactive: boolean; reset: number; fit: number; onFallback: () => void;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const fallback = <div className={styles.loading}><p>3D is unavailable on this device.</p><button onClick={onFallback}>View your plan</button></div>;
  // Context is a separate package-owned visual reference. Camera framing stays
  // centred on the pergola rather than zooming out to fit a two-storey house.
  const objects = useMemo(() => scene.layers.filter((layer) => layer.visibleByDefault).flatMap((layer) => layer.objects)
    .filter((object) => !(covering && object.type === 'roof_plane') && !object.type.startsWith('house_') && !object.type.startsWith('reference_') && (object.type !== 'roof_flashing' || object.metadata?.representativeGableRidge)), [scene, covering]);
  const fitPoints = useMemo(() => objects.flatMap((object) => object.type === 'member_prism'
    ? [object.centerline.start, object.centerline.end]
    : object.type === 'roof_plane' || object.type === 'roof_cladding_panel' ? object.boundary : []), [objects]);
  const bounds = useMemo(() => computeSceneBoundsFromPoints(fitPoints), [fitPoints]);
  // Fit first-floor supports without zooming out to fit the entire house.
  const cameraPoints = useMemo(() => ceilingView ? fitPoints.filter(p => p.z >= 2000) : context?.elevated ? [...fitPoints,
    ...context.architecture.supports.flatMap(support => [support.min, support.max])] : fitPoints, [fitPoints, context, ceilingView]);
  const cameraBounds = useMemo(() => computeSceneBoundsFromPoints(cameraPoints), [cameraPoints]);
  const roof = useMemo(() => scene.layers.flatMap((layer) => layer.objects).flatMap(object => object.type === 'roof_plane' ? object.boundary : []), [scene]);
  if (unavailable) return fallback;
  return <SceneBoundary fallback={fallback}>
    <Canvas orthographic frameloop="demand" dpr={[1, 1.75]} style={{ touchAction: 'pan-y' }}
      camera={{ position: [12000, -18000, 12000], up: [0, 0, 1], near: 1, far: 100000 }}
      fallback={fallback}>
      <ContextWatch onFallback={() => { setUnavailable(true); onFallback(); }} />
      <PreviewLighting />
      {covering && <PreviewRoofFinish covering={covering} />}
      {context && <PreviewSurroundings hideGround={ceilingView} context={context} bounds={bounds} productPoints={fitPoints} />}
      <PreviewCamera under={under} bounds={cameraBounds} fitPoints={cameraPoints} enabled={interactive} reset={reset} fit={fit} surroundings={Boolean(context)} />
      <group>{objects.map((object) => object.type === 'roof_plane' || object.type === 'roof_cladding_panel'
        ? <PreviewRoof key={object.id} object={object} />
        : <SceneObjectNode key={object.id} object={object} color="#242824" memberAppearance={{ roughness: .38, metalness: .2, envMapIntensity: .8 }}
          selected={false} hovered={false} onSelect={noop} onHoverEnter={noop} onHoverLeave={noop} onFocus={noop} clippingPlanes={[]} />)}</group>
      {interactive && activeDimension && roof.length > 0 && <PreviewDimensionGuide axis={activeDimension} plan={plan} roof={roof} />}
    </Canvas>
  </SceneBoundary>;
}
