import { Environment, Lightformer } from '@react-three/drei';

export default function PreviewLighting({night=false}:{night?:boolean}) {
  if(night)return <><ambientLight intensity={.1}/><directionalLight position={[3000,-2000,8000]} intensity={.12} color="#adc2dc"/></>;
  return <>
    <ambientLight intensity={.65} />
    <directionalLight position={[3500, 4500, 8000]} intensity={2.2} color="#fff8ed" />
    <directionalLight position={[-4000, -2000, 5000]} intensity={1.15} color="#e4edf3" />
    {/* A small procedural studio environment: no remote image or texture fetch. */}
    <Environment resolution={128} frames={1}>
      <Lightformer intensity={2.5} color="#ffffff" position={[0, 0, 5]} scale={[10, 7, 1]} />
      <Lightformer intensity={3.5} color="#ffffff" position={[-4, -6, 6]} scale={[2, 8, 1]} />
      <Lightformer intensity={1.8} color="#eff5fb" position={[-4, 0, 1]} rotation={[0, Math.PI / 2, 0]} scale={[3, 8, 1]} />
      <Lightformer intensity={1.1} color="#fff3e2" position={[4, 2, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 8, 1]} />
    </Environment>
  </>;
}
