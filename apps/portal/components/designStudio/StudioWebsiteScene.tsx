'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PreviewScene, PreviewSurroundings, PreviewPlan, useLighting } from '@sp/configurator/react';
import { type PreviewGeometryOptions, solvePergolaPreview, solveSimpleCoverSurroundings } from '@sp/configurator/geometry';
import type { WebsiteSubmittedDesignV1 } from '@sp/configurator/website';
import css from './StudioWebsite.module.css';
export default function StudioWebsiteScene({ design, geometryOptions, section='Shape', onDimension }: { design: WebsiteSubmittedDesignV1;geometryOptions?:PreviewGeometryOptions;section?:string;onDimension?:(axis:'width'|'projection')=>void }) {
 const lighting = useLighting();
 const [fit, setFit] = useState(0);
 const night = useRef({ current: 0, listeners: new Set<() => void>() });
 useEffect(() => { night.current.current = lighting?.night ? 1 : 0; night.current.listeners.forEach(fn => fn()); }, [lighting?.night]);
 const solved = useMemo(() => solvePergolaPreview(design.input, design.roof, geometryOptions), [design,geometryOptions]);
 if (!solved.geometry) return <div role="alert" className={css.sceneError}>This design cannot be shown. {solved.messages.map(m => m.message).join(' ')}</div>;
 const context=solveSimpleCoverSurroundings(design.input,solved.geometry.assembly,design.roof);
 return <div className={css.canvas}>
 <div style={{position:'absolute',inset:0,visibility:lighting?.view==='Plan'?'hidden':'visible'}} aria-hidden={lighting?.view==='Plan'}>
  <PreviewScene fitPadding={0.84} scene={solved.geometry.viewerScene} plan={solved.geometry.plan} covering={solved.geometry.covering} context={context}
   activeDimension={null} nightPresentation={night.current} interactive={lighting?.view!=='Plan'} reset={0} fit={fit} onFallback={() => lighting?.setView('Plan')} showReferenceBase={!context} renderContext={({bounds,fitPoints}) => <>{context&&<PreviewSurroundings context={context} bounds={bounds} productPoints={fitPoints} studio reducedDetail/>}<mesh name="presentation-floor" receiveShadow position={[(solved.geometry!.plan.extents.minX+solved.geometry!.plan.extents.maxX)/2,(solved.geometry!.plan.extents.minY+solved.geometry!.plan.extents.maxY)/2,context?context.ground.max.z-4:-4]}><planeGeometry args={[80000,80000]}/><meshStandardMaterial color="#d9d3c7" roughness={1}/></mesh></>} />
 </div>
 {lighting?.view==='Plan'&&<PreviewPlan preserveTool formatDimension={mm=>`${mm/1000} m`} section={section==='Roof'?'roof':'structure'} profile={design.roof.finish?.profile} trayWidth={design.roof.finish?.trayWidth} roofPlanes={solved.geometry.assembly.roofPlanes} covering={solved.geometry.covering} plan={solved.geometry.plan} flashings={solved.geometry.assembly.roofFlashings} context={context} activeDimension={null}/>}
 <div className={css.viewTools}>{(['3D','Plan'] as const).map(v=><button key={v} aria-pressed={lighting?.view===v} onClick={()=>lighting?.setView(v)}>{v}</button>)}<button onClick={()=>setFit(n=>n+1)}>Fit view</button><button aria-pressed={lighting?.night} onClick={()=>{if(lighting?.view==='Plan')lighting.setView('3D');lighting?.setNight(!lighting.night);}}>{lighting?.night?'Day':'Night'}</button></div>
 {onDimension&&<div className={css.dimensionTools}><button onClick={()=>onDimension('width')}>Edit width · {design.input.widthMm/1000} m</button><button onClick={()=>onDimension('projection')}>Edit projection · {design.input.projectionMm/1000} m</button></div>}
 </div>;
}
