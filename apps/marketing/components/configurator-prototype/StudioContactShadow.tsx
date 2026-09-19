/** Cheap, restrained ambient contact cue on the terrace; no live shadow pass. */
export default function StudioContactShadow({ width, depth, y = 0 }: { width: number; depth: number; y?: number }) {
  return <mesh position={[0,y,3]} renderOrder={2}>
    <planeGeometry args={[width*1.25,depth*1.25]}/>
    <shaderMaterial transparent depthWrite={false}
      vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
      fragmentShader="varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.0;float a=exp(-dot(p,p)*3.8)*.14;gl_FragColor=vec4(.23,.22,.20,a);}"/>
  </mesh>;
}
