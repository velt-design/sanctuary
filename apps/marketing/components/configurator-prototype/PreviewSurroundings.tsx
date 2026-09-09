import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ExtrudeGeometry, Group, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Shape, Vector2, Vector3 } from 'three';
import type { ContextSection, RepresentativeSurroundings } from '@sp/geometry';
import type { SceneBounds } from '@sp/geometry-viewer';
import HouseContextMaterial from './HouseContextMaterial';
import PreviewLandscape from './PreviewLandscape';
import Box from './ContextBoxMesh';
import ContextWall from './ContextWall';

function Section({ section, color, fadeAbove }: { section: ContextSection; color: string; fadeAbove?: number }) {
  const geometry = useMemo(() => {
    const shape = new Shape(section.section.map(({ y, z }) => new Vector2(y, z)));
    const mesh = new ExtrudeGeometry(shape, { depth: section.endX - section.startX, bevelEnabled: false });
    const alongY = section.extrusionAxis === 'y';
    mesh.applyMatrix4(new Matrix4().makeBasis(alongY ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), new Vector3(0, 0, 1), alongY ? new Vector3(0, -1, 0) : new Vector3(1, 0, 0)));
    mesh.translate(alongY ? 0 : section.startX, alongY ? section.endX : 0, 0);
    return mesh;
  }, [section]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name={section.id} geometry={geometry}>
    {fadeAbove === undefined ? <meshStandardMaterial color={color} roughness={.65} transparent /> : <HouseContextMaterial color={color} fadeAbove={fadeAbove} />}
  </mesh>;
}

export default function PreviewSurroundings({ hideGround = false, context, bounds, productPoints }: { hideGround?: boolean; context: RepresentativeSurroundings; bounds: SceneBounds; productPoints: { x: number; y: number; z: number }[] }) {
  const house = useRef<Group>(null);
  const direction = useMemo(() => new Vector3(), []);
  const { architecture, ground, roof, roofEnclosure, gutter, brackets } = context;
  const fadeAbove = context.connection === 'facade' ? context.ledger.topZ + 180 : 40000;
  useFrame(({ camera, gl }) => {
    // Fade the architectural backdrop as the orbit crosses behind the house.
    // Fixed support brackets stay visible so the connection can be inspected.
    camera.getWorldDirection(direction);
    const fade = MathUtils.smoothstep(direction.y, -.2, .2);
    house.current?.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      object.material.opacity = 1 - fade * .95;
      object.material.depthWrite = fade < .05;
    });
    gl.domElement.dataset.houseOpacity = (1 - fade * .95).toFixed(2);
  });
  return <group name="representative-surroundings">
    {!hideGround && <>
    <Box box={ground} color="#d1d6c8" />
    <Box box={architecture.terrace} color="#cbc8bd" />
    {architecture.supports.map(support => <Box key={support.id} box={support} color="#a5aa9e" />)}
    <PreviewLandscape context={context} bounds={bounds} productPoints={productPoints} />
    {/* Soft contact cues from solved feet, without treating clear acrylic as an opaque shadow caster. */}
    {context.postFeet.map((point, index) => <mesh key={index} position={[point.x, point.y, point.z + 1]} renderOrder={1}>
      <planeGeometry args={[600, 600]} />
      <shaderMaterial transparent depthWrite={false}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader="varying vec2 vUv; void main() { vec2 p = vUv - 0.5; float a = exp(-dot(p,p) * 38.0) * 0.3; gl_FragColor = vec4(0.22, 0.24, 0.2, a); }" />
    </mesh>)}
    </>}
    <group ref={house} name="house-context">
      <ContextWall wall={context.wall} opening={architecture.opening} fadeAbove={fadeAbove} />
      {architecture.glazing.map((pane, index) => <Box key={pane.id} box={pane} color={index ? '#a6b5ad' : '#b4c0b7'} glazing />)}
      {architecture.frame.map(frame => <Box key={frame.id} box={frame} color="#7c8578" />)}
      <Section section={roofEnclosure} color="#e0e2d7" fadeAbove={fadeAbove} />
      <Section section={roof} color="#c5cdbd" fadeAbove={fadeAbove} />
      <Section section={gutter} color="#bac4b1" fadeAbove={fadeAbove} />
    </group>
    {brackets.map((section) => <Section key={section.id} section={section} color="#242824" />)}
  </group>;
}
