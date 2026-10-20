'use client';
import {useMemo,useEffect} from 'react';
import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2,DoubleSide} from 'three';
import {Line} from '@react-three/drei';
import type {Point3,RenderMesh3D} from '@sp/geometry';
import {houseWorld} from '@/lib/designStudio/studioHouseGeometry';
import {boxedHouseSoffits} from '@/lib/designStudio/studioHouseWebsiteContact';
import type {StudioHouseGeometry} from '@/lib/designStudio/studioHouseGeometry';
/** Studio presentation consumes solved polygons; no workbench scene dispatcher/materials. */
function Surface({points,color}:{points:Point3[];color:string}){
 const geometry=useMemo(()=>{const g=new BufferGeometry(),a=points[0],b=points[1],c=points[2];const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};const axis=Math.abs(normal.z)>=Math.abs(normal.x)&&Math.abs(normal.z)>=Math.abs(normal.y)?'z':Math.abs(normal.x)>Math.abs(normal.y)?'x':'y';const projected=points.map(p=>new Vector2(axis==='x'?p.y:p.x,axis==='z'?p.y:p.z));const triangles=ShapeUtils.triangulateShape(projected,[]);g.setAttribute('position',new Float32BufferAttribute(triangles.flatMap(t=>t.flatMap(i=>[points[i].x,points[i].y,points[i].z])),3));g.computeVertexNormals();return g;},[points]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.9} side={DoubleSide}/></mesh>;
}
function Solid({mesh,color,house}:{mesh:RenderMesh3D;color:string;house:StudioHouseGeometry['house']}){
 const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(mesh.faces.flatMap(face=>face.flatMap(i=>{const p=houseWorld(house,mesh.vertices[i]);return [p.x,p.y,p.z];})),3));g.computeVertexNormals();return g;},[mesh,house]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={.82} side={DoubleSide}/></mesh>;
}
export default function StudioHouseNode({geometry,selected,onSelect,refined=false}:{geometry:StudioHouseGeometry;selected:boolean;onSelect:()=>void;refined?:boolean}){
 const centre=geometry.footprint.reduce((a,p)=>({x:a.x+p.x/geometry.footprint.length,y:a.y+p.y/geometry.footprint.length}),{x:0,y:0});
 const solids=geometry.model.solids;
 return <group onClick={e=>{e.stopPropagation();onSelect();}}>
 {refined&&solids?<>
  <Surface points={geometry.footprint.map(p=>({x:centre.x+(p.x-centre.x)*1.045,y:centre.y+(p.y-centre.y)*1.075,z:1}))} color="#c5bfb2"/>
  {solids.surfaceSolids.filter(s=>s.kind!=='soffit'&&s.renderMesh).map(s=><Solid key={s.id} mesh={s.renderMesh!} house={geometry.house} color={s.kind==='roof'?'#738477':s.kind==='fascia'?'#dddcd2':'#e9e5db'}/>)}
  {solids.linearSolids.filter(s=>s.renderMesh).map(s=><Solid key={s.id} mesh={s.renderMesh!} house={geometry.house} color="#adb7aa"/>)}
  {boxedHouseSoffits(geometry).map((s,i)=><Surface key={`${s.side}:${i}`} points={s.world} color="#d8d7cc"/>)}
 </>:<>
  {geometry.walls.map((p,i)=><Surface key={`wall${i}`} points={p} color="#ddd8cc"/>)}
  {geometry.roof.map((p,i)=><Surface key={`roof${i}`} points={p} color="#7e837b"/>)}
  {geometry.eaves.map((p,i)=><Surface key={`eave${i}`} points={p} color="#b4b7ad"/>)}
  {geometry.soffits.map((p,i)=><Surface key={`soffit${i}`} points={p} color="#d2cfc5"/>)}
 </>}
 {selected&&<Line points={[...geometry.footprint,geometry.footprint[0]].map(p=>[p.x,p.y,10])} color="#826344" lineWidth={2}/>}</group>;
}
