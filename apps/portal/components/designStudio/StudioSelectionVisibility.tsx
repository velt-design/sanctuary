'use client';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Box3,Frustum,Matrix4,Vector3} from 'three';
import type {SelectionVisibility} from './studioPlacementMeasurements';

/** Observe the current camera only. No fit, controls, rendering or event ownership. */
export default function StudioSelectionVisibility({points,onChange}: {
  points: readonly {x:number;y:number;z:number}[]; onChange:(visibility:SelectionVisibility)=>void;
}) {
  const box=useMemo(()=>new Box3().setFromPoints(points.map(p=>new Vector3(p.x,p.y,p.z))),[points]);
  const corners=useMemo(()=>[box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>new Vector3(x,y,z)))),[box]);
  const scratch=useMemo(()=>({frustum:new Frustum(),matrix:new Matrix4()}),[]),last=useRef<SelectionVisibility|null>(null);
  useFrame(({camera})=>{
    scratch.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    scratch.frustum.setFromProjectionMatrix(scratch.matrix);
    // A read-only classification of the existing selection bounds, not a mesh
    // occlusion test. Intersection alone misses the ordinary partly clipped case.
    const visibility:SelectionVisibility=box.isEmpty()?'inside':!scratch.frustum.intersectsBox(box)?'outside':corners.every(p=>scratch.frustum.containsPoint(p))?'inside':'partial';
    if(last.current!==visibility){last.current=visibility;onChange(visibility);}
  });
  return null;
}
