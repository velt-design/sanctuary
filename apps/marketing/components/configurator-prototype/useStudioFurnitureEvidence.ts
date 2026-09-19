import { useLayoutEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Box3, Group, Mesh, MeshStandardMaterial } from 'three';
import type { FurniturePlacement } from './studioFurnitureLayout';

/** Development evidence compares real rendered solids with planned envelopes. */
export function useStudioFurnitureEvidence(root:RefObject<Group|null>, layout:FurniturePlacement[]){
  const {gl}=useThree();
  useLayoutEffect(()=>{
    if(process.env.NODE_ENV!=='development'||!root.current)return;
    root.current.updateWorldMatrix(true,true);
    gl.domElement.dataset.furniture=JSON.stringify(layout.map((item,i)=>{
      const bounds=new Box3();
      root.current!.children[i]?.traverse(object=>{
        if(!(object instanceof Mesh))return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        if(!materials.every(m=>m instanceof MeshStandardMaterial))return;
        object.geometry.computeBoundingBox();
        if(object.geometry.boundingBox)bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      });
      return {kind:item.kind,planned:item.bounds,actual:{minX:bounds.min.x,minY:bounds.min.y,maxX:bounds.max.x,maxY:bounds.max.y}};
    }));
    return ()=>{delete gl.domElement.dataset.furniture;};
  },[gl,root,layout]);
}
