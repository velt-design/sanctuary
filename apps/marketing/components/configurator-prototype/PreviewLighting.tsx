import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { AmbientLight, DirectionalLight } from 'three';
import { useNightAmount } from './DayNightTransition';

export default function PreviewLighting({ studio = false, review = false, reducedDetail = false }: { studio?: boolean; review?: boolean; reducedDetail?: boolean }) {
  const amount = useNightAmount();
  const ambient = useRef<AmbientLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  useFrame(({ scene }) => {
    const night = amount.current;
    if (ambient.current) ambient.current.intensity = (studio ? .48 : .65) * (1-night) + (studio ? .18 : .1)*night;
    if (sun.current) sun.current.intensity = (review ? 1.25 : studio ? 1.55 : 2.2) * (1 - night);
    if (fill.current) fill.current.intensity = (review ? 1.05 : studio ? .85 : 1.15) * (1 - night);
    if (moon.current) moon.current.intensity = (studio ? .26 : .12) * night;
    scene.environmentIntensity = (review ? .8 : studio ? .65 : 1) * (1 - night) + (studio ? .06 : 0) * night;
  }, -1);
  return <>
    <ambientLight ref={ambient} intensity={.65} />
    <directionalLight castShadow={studio} shadow-mapSize={reducedDetail ? [1024,1024] : [2048,2048]} shadow-camera-left={-12000} shadow-camera-right={12000} shadow-camera-top={12000} shadow-camera-bottom={-12000} shadow-camera-near={100} shadow-camera-far={40000} shadow-bias={-.0002} shadow-normalBias={6} shadow-radius={review ? 6 : 4} ref={sun} position={studio ? [-3000,6000,8000] : [3500,4500,8000]} intensity={2.2} color="#fff8ed" />
    <directionalLight ref={fill} position={[-4000, -2000, 5000]} intensity={1.15} color="#e4edf3" />
    <directionalLight ref={moon} position={[3000, -2000, 8000]} intensity={0} color="#adc2dc" />
    {/* Capture once and fade its contribution; toggles never rebuild the environment. */}
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={2.5} color="#ffffff" position={[0, 0, 5]} scale={[10, 7, 1]} />
      <Lightformer intensity={3.5} color="#ffffff" position={[-4, -6, 6]} scale={[2, 8, 1]} />
      <Lightformer intensity={1.8} color="#eff5fb" position={[-4, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={[3, 8, 1]} />
      <Lightformer intensity={1.1} color="#fff3e2" position={[4, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 8, 1]} />
    </Environment>
  </>;
}
