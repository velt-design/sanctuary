import { createContext, useContext, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, MeshStandardMaterial } from 'three';
import type { OrbitControls } from 'three-stdlib';

export const StudioTreatment = createContext(false);
export const useStudioTreatment = () => useContext(StudioTreatment);

/** Bake static directional shadows after edits; keep orbiting inexpensive. */
export function StudioQuality({ revision, onReducedDetail }: { revision: string; onReducedDetail?: (reduced: boolean) => void }) {
  const { gl, scene, controls, invalidate, setDpr } = useThree();
  const performanceSample=useRef({frames:0,total:0,reduced:false});
  useFrame((_,delta) => {
    gl.domElement.dataset.studioFrames = String(Number(gl.domElement.dataset.studioFrames ?? 0) + 1);
    const sample=performanceSample.current;
    if(gl.domElement.dataset.studioState==='moving'&&!sample.reduced){
      // Cap isolated stalls rather than discarding the slowest frames entirely.
      sample.frames++; sample.total+=Math.min(delta,.15);
      if(sample.frames>=18){
        if(sample.total/sample.frames>.045){sample.reduced=true;gl.domElement.dataset.studioDetail='reduced';onReducedDetail?.(true);}
        sample.frames=0;sample.total=0;
      }
    }
  });
  useEffect(() => {
    const orbit = controls as OrbitControls | null;
    let timer: ReturnType<typeof setTimeout>;
    gl.shadowMap.autoUpdate = false;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setDpr(Math.min(window.devicePixelRatio, performanceSample.current.reduced?1.25:1.75));
        scene.traverse(object => {
          if (!(object instanceof Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          // Transparent roof/screen/glazing must never cast a solid roof shadow.
          object.castShadow = materials.every(m => m instanceof MeshStandardMaterial && m.opacity >= .99 && !m.transparent);
          object.receiveShadow = materials.every(m => m instanceof MeshStandardMaterial && m.opacity >= .99);
        });
        gl.shadowMap.needsUpdate = true;
        gl.domElement.dataset.studioSetting=scene.getObjectByName('illustrative-setting')?'review':'choices';
        gl.domElement.dataset.studioState = 'settled';
        invalidate();
      }, 180);
    };
    const start = () => { clearTimeout(timer); setDpr(1); gl.domElement.dataset.studioState = 'moving'; };
    orbit?.addEventListener('start', start);
    orbit?.addEventListener('end', settle);
    settle();
    return () => {
      clearTimeout(timer);
      orbit?.removeEventListener('start', start);
      orbit?.removeEventListener('end', settle);
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, scene, controls, invalidate, setDpr, revision]);
  return null;
}
