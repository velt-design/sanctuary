import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Html, type OrbitControls } from '@react-three/drei';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { SceneBounds } from '@sp/geometry-viewer';

type Result = { frames: number; elapsedMs: number; medianFrameMs: number; p95FrameMs: number; over33ms: number; sceneReadyMs: number; calls: number; triangles: number; dpr: number };
const quantile = (values: number[], q: number) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))] ?? 0;
/** Finite, user-triggered development measurement. No persistent design changes. */
export default function SceneBenchmark({bounds}:{bounds:SceneBounds}) {
  const {camera,controls,gl,invalidate,setDpr}=useThree();
  const [enabled]=useState(()=>new URLSearchParams(window.location.search).get('bench')==='1');
  const [benchmarkDpr]=useState(()=>{const value=Number(new URLSearchParams(window.location.search).get('benchDpr')??1);return Number.isFinite(value)?Math.min(2,Math.max(1,value)):1;});
  const [result,setResult]=useState<Result|null>(null),[running,setRunning]=useState(false);
  const ready=useRef(0), active=useRef(false), started=useRef(0), previous=useRef(0), intervals=useRef<number[]>([]);
  const saved=useRef<{position:Vector3;target:Vector3;enabled:boolean;dpr:number}|null>(null);
  const orbit=controls as ComponentRef<typeof OrbitControls>|null;
  useEffect(()=>addAfterEffect(()=>{if(!ready.current)ready.current=performance.now();}),[]);
  function finish(){
    if(!active.current||!orbit)return;
    active.current=false;setRunning(false);
    const values=intervals.current;
    setResult({frames:values.length,elapsedMs:performance.now()-started.current,medianFrameMs:quantile(values,.5),p95FrameMs:quantile(values,.95),over33ms:values.filter(v=>v>33.34).length,sceneReadyMs:ready.current,calls:gl.info.render.calls,triangles:gl.info.render.triangles,dpr:gl.getPixelRatio()});
    if(saved.current){camera.position.copy(saved.current.position);orbit.target.copy(saved.current.target);orbit.enabled=saved.current.enabled;setDpr(saved.current.dpr);orbit.update();}
    invalidate();
  }
  useFrame(()=>{
    if(!active.current||!orbit)return;
    // Adaptive-quality settling may otherwise restore DPR during the run.
    if(gl.getPixelRatio() !== benchmarkDpr) setDpr(benchmarkDpr);
    const now=performance.now();
    if(previous.current && now-started.current > 300) intervals.current.push(now-previous.current);
    previous.current=now;
    const progress=Math.min(1,(now-started.current)/6000), angle=progress*Math.PI*2+.65;
    const radius=bounds.size*2.8;
    camera.position.set(bounds.center.x+Math.sin(angle)*radius,bounds.center.y+Math.cos(angle)*radius,bounds.center.z+radius*.28);
    orbit.target.set(bounds.center.x,bounds.center.y,bounds.center.z);camera.lookAt(orbit.target);camera.updateMatrixWorld();
    if(progress>=1)finish();else invalidate();
  });
  useEffect(()=>()=>{if(active.current&&saved.current&&orbit){orbit.enabled=saved.current.enabled;camera.position.copy(saved.current.position);orbit.target.copy(saved.current.target);}},[camera,orbit]);
  if(!enabled)return null;
  return <Html fullscreen style={{pointerEvents:'none'}}><div style={{position:'absolute',bottom:38,left:12,padding:10,maxWidth:320,font:'11px monospace',background:'#fff',color:'#111',pointerEvents:'auto',border:'1px solid #aaa'}}>
    <button disabled={running} onClick={()=>{if(!orbit)return;saved.current={position:camera.position.clone(),target:orbit.target.clone(),enabled:orbit.enabled,dpr:gl.getPixelRatio()};orbit.enabled=false;setDpr(benchmarkDpr);intervals.current=[];previous.current=0;started.current=performance.now();active.current=true;setRunning(true);invalidate();}}>{running?'Measuring 6-second orbit…':'Measure scene'}</button>
    <p>{process.env.NODE_ENV === 'production' ? 'Optimized preview' : 'Development benchmark'} · fixed {benchmarkDpr}× resolution · camera restored</p>
    {result&&<output data-scene-benchmark={JSON.stringify(result)}>{JSON.stringify(result)}</output>}
  </div></Html>;
}
