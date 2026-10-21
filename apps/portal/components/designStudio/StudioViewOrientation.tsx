'use client';
import {useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';

/** Read-only compass: explains orbit heading without changing either viewport. */
export default function StudioViewOrientation(){
 const {camera}=useThree(),last=useRef<number[]>([]),[axes,setAxes]=useState<number[]>([]);
 useFrame(()=>{
  const m=camera.matrixWorldInverse.elements,next=[m[0],-m[1],m[4],-m[5]];
  if(next.some((v,i)=>Math.abs(v-(last.current[i]??Infinity))>.002)){last.current=next;setAxes(next);}
 });
 if(!axes.length)return null;
 return <Html fullscreen calculatePosition={(_object,_camera,size)=>[size.width/2,size.height/2]} onOcclude={()=>{ /* Viewport UI has no world-space occlusion. */ }} style={{pointerEvents:'none'}}><svg width="86" height="86" viewBox="0 0 86 86" aria-label="3D world orientation" style={{position:'absolute',right:12,top:12,overflow:'visible'}}>
  {[0,1].map(i=>{const x=43+axes[i*2]*27,y=43+axes[i*2+1]*27;return <g key={i}><line x1="43" y1="43" x2={x} y2={y} stroke="#46534a" strokeWidth="1.5"/><circle cx={x} cy={y} r="2" fill="#46534a"/><text x={43+axes[i*2]*38} y={47+axes[i*2+1]*38} textAnchor="middle" fontSize="12" fill="#26332a">{i?'+Y':'+X'}</text></g>;})}
 </svg></Html>;
}
