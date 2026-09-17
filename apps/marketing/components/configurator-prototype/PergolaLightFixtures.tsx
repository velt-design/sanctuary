import {selectedCedarLights} from './cedarSelection';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {useNightAmount} from './DayNightTransition';
import {Matrix4,Object3D,Quaternion,Vector3,MeshStandardMaterial,SpotLight} from 'three';
import {layoutRafterLights,type StripSite,type LightSite} from '@sp/geometry';
import {useLighting} from './LightingProvider';
function Diffuser(){
 const material=useRef<MeshStandardMaterial>(null),amount=useNightAmount();
 useFrame(()=>{if(material.current)material.current.emissiveIntensity=4*amount.current;},-1);
 return <meshStandardMaterial ref={material} color="#fff1ce" emissive="#ffd08a" emissiveIntensity={0} toneMapped={false}/>;
}
const vec=(p:{x:number;y:number;z:number})=>new Vector3(p.x,p.y,p.z);
function Strip({site}:{site:StripSite}){
 const {position,q,length}=useMemo(()=>{const a=vec(site.start),b=vec(site.end),u=b.clone().sub(a).normalize(),n=vec(site.normal),y=n.clone().cross(u).normalize();return {position:a.clone().add(b).multiplyScalar(.5).addScaledVector(n,-8),q:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(u,y,n)),length:a.distanceTo(b)};},[site]);
 return <group position={position} quaternion={q}><mesh><boxGeometry args={[length,16,16]}/><meshStandardMaterial color="#242824" roughness={.5}/></mesh><mesh position={[0,0,-8.2]}><boxGeometry args={[length,12,.5]}/><Diffuser/></mesh></group>;
}
function Spot({site}:{site:LightSite}){
 const q=useMemo(()=>new Quaternion().setFromUnitVectors(new Vector3(0,1,0),vec(site.normal)),[site.normal]);
 return <group position={vec(site.point)} quaternion={q}><mesh><cylinderGeometry args={[site.diameter/2,site.diameter/2,4,16]}/><meshStandardMaterial color="#242824"/></mesh><mesh position={[0,-2.3,0]}><cylinderGeometry args={[site.diameter*.4,site.diameter*.4,.6,16]}/><Diffuser/></mesh></group>;
}
function WarmLight({position,normal,intensity}:{position:Vector3;normal:Vector3;intensity:number}){
 const light=useRef<SpotLight>(null),amount=useNightAmount();
 useFrame(()=>{if(light.current)light.current.intensity=intensity*amount.current;},-1);
 const target=useMemo(()=>{const t=new Object3D();t.position.copy(position).addScaledVector(normal,-1000);return t;},[position,normal]);
 return <><primitive object={target}/><spotLight ref={light} position={position} target={target} intensity={0} distance={6500} decay={2} angle={1.15} penumbra={.85} color="#ffd7a4"/></>;
}
export default function PergolaLightFixtures(){
 const w=useLighting()!;
 const spots=useMemo(()=>[...layoutRafterLights(w.sites.rafters,w.value.rafterAmount??'off'),...selectedCedarLights(w.sites.cedar,w.value)],[w.sites,w.value]);
 const strips=w.sites.strips.filter(s=>w.value.strips.includes(s.id));
 const sources=[...spots.map(s=>({position:vec(s.point).addScaledVector(vec(s.normal),-40),normal:vec(s.normal)})),...strips.flatMap(s=>[.25,.75].map(t=>({position:vec(s.start).lerp(vec(s.end),t).addScaledVector(vec(s.normal),-40),normal:vec(s.normal)})))];
 const lightCount=Math.min(12,sources.length);
 return <group name="pergola-lighting">
 <>{spots.map(s=><Spot key={s.id} site={s}/>)}{strips.map(s=><Strip key={s.id} site={s}/>)}</>
 {Array.from({length:lightCount},(_,i)=>{const p=sources[Math.floor((i+.5)*sources.length/lightCount)];return <WarmLight key={i} position={p.position} normal={p.normal} intensity={2400000*Math.min(2,sources.length/lightCount)}/>;})}
 </group>;
}
