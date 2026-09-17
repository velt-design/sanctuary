import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { AmbientLight, DirectionalLight } from 'three';
import { useNightAmount } from './DayNightTransition';

export default function PreviewLighting() {
  const amount = useNightAmount();
  const ambient = useRef<AmbientLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const moon = useRef<DirectionalLight>(null);
  useFrame(({ scene }) => {
    const night = amount.current;
    if (ambient.current) ambient.current.intensity = .65 + (.1 - .65) * night;
    if (sun.current) sun.current.intensity = 2.2 * (1 - night);
    if (fill.current) fill.current.intensity = 1.15 * (1 - night);
    if (moon.current) moon.current.intensity = .12 * night;
    scene.environmentIntensity = 1 - night;
  }, -1);
  return <>
    <ambientLight ref={ambient} intensity={.65} />
    <directionalLight ref={sun} position={[3500, 4500, 8000]} intensity={2.2} color="#fff8ed" />
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
