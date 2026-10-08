import { BackSide } from 'three';

/** Baked once into the existing environment cube: no asset request or live pass. */
export default function OutdoorEnvironment() {
  return <mesh>
    <sphereGeometry args={[50, 32, 16]}/>
    <shaderMaterial side={BackSide} toneMapped={false}
      vertexShader="varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
      fragmentShader={`varying vec3 vDirection;
        void main(){
          vec3 d=normalize(vDirection);
          vec3 horizon=vec3(.88,.9,.86), sky=vec3(.39,.59,.79), ground=vec3(.27,.24,.19);
          vec3 color=mix(horizon,sky,pow(max(d.z,0.0),.45));
          color=mix(color,ground,(1.0-smoothstep(-.55,.0,d.z)));
          float sun=max(dot(d,normalize(vec3(-.65,.45,.8))),0.0);
          color+=vec3(1.0,.85,.62)*(pow(sun,32.0)*.7+pow(sun,700.0)*5.0);
          gl_FragColor=vec4(color,1.0);
        }`}/>
  </mesh>;
}
