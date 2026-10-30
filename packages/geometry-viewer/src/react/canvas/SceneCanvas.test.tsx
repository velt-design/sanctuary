import React, { act, Component, createContext, StrictMode, Suspense, useContext, useEffect } from 'react';
import { createRoot as createDomRoot, type Root } from 'react-dom/client';
import { createPortal, useThree, type CanvasProps, type RootState } from '@react-three/fiber';
import { Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { PCFShadowMap, PCFSoftShadowMap, Scene, WebGLCoordinateSystem, type WebGLRenderer } from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SceneCanvas } from './SceneCanvas';
import { sceneCatalogue } from './sceneCatalogue';
import { SceneRootLifecycle } from './sceneRootLifecycle';

// Vitest externalizes Fiber/Drei to CJS. Resolve Three to that same real public
// package instance, rather than mixing its ESM and CJS class identities.
vi.mock('three', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('three');
});

// No Canvas, extend(THREE), Fiber mock or test-renderer catalogue is used in this
// isolated module. Only the GPU boundary is substituted; roots/reconciler/events,
// context bridge, catalogue and real helper components execute.
const Context = createContext('initial');
let size = { width: 640, height: 480 };
const observers = new Set<ResizeObserverCallback>();
let dom: Root;
let container: HTMLDivElement;
const states: RootState[] = [];
const renderers: ReturnType<typeof renderer>[] = [];
function renderer(canvas: HTMLCanvasElement) {
  const gl = {
    domElement: canvas, render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(),
    getPixelRatio: () => 1, getSize: (target: { set: (x: number, y: number) => unknown }) => target.set(640, 480),
    shadowMap: { enabled: false, type: 0 }, renderLists: { dispose: vi.fn() },
    forceContextLoss: vi.fn(), coordinateSystem: WebGLCoordinateSystem,
    getRenderTarget: () => null, setRenderTarget: vi.fn(), getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0, xr: {
      enabled: false, isPresenting: false, addEventListener: vi.fn(),
      removeEventListener: vi.fn(), setAnimationLoop: vi.fn(),
    },
  };
  renderers.push(gl);
  return gl;
}
const makeRenderer = ({ canvas }: { canvas: HTMLCanvasElement | OffscreenCanvas }) =>
  renderer(canvas as HTMLCanvasElement) as unknown as WebGLRenderer;
function Probe({ name = 'probe' }: { name?: string }) {
  const value = useContext(Context);
  const state = useThree();
  useEffect(() => { states.push(state); });
  return <group name={`${name}:${value}`} />;
}
class Boundary extends Component<React.PropsWithChildren, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <output>{this.state.error}</output> : this.props.children; }
}
async function paint(node: React.ReactNode) {
  await act(async () => { dom.render(node); });
  // A real ResizeObserver delivers an initial observation after observe().
  await act(async () => { for (const callback of observers) callback([], {} as ResizeObserver); });
  await act(async () => { await new Promise((done) => setTimeout(done, 70)); });
}
async function resize(width: number, height: number) {
  size = { width, height };
  await act(async () => { for (const callback of observers) callback([], {} as ResizeObserver); });
  await act(async () => { await new Promise((done) => setTimeout(done, 70)); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    callback: ResizeObserverCallback;
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
    unobserve() {}
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    ...size, top: 0, left: 0, right: size.width, bottom: size.height, x: 0, y: 0, toJSON() {},
  }));
  size = { width: 640, height: 480 };
  states.length = 0; renderers.length = 0;
  container = document.createElement('div'); document.body.append(container);
  dom = createDomRoot(container);
});
afterEach(async () => {
  await act(async () => { dom.unmount(); });
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  container.remove(); observers.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('starts with an explicit fresh catalogue and rejects an unregistered intrinsic', async () => {
  expect(Object.keys(sceneCatalogue)).toHaveLength(19);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  await paint(<Boundary><SceneCanvas gl={makeRenderer} frameloop="never"><torusGeometry /></SceneCanvas></Boundary>);
  expect(container.textContent).toContain('TorusGeometry is not part of the THREE namespace');
  error.mockRestore();
});

it('mounts real supported helper branches and portal CubeCamera without the full catalogue', async () => {
  const portal = new Scene();
  await paint(<SceneCanvas gl={makeRenderer} frameloop="never">
    <Probe />
    <mesh><boxGeometry /><meshStandardMaterial /></mesh>
    <instancedMesh args={[undefined, undefined, 2]}><cylinderGeometry /><meshBasicMaterial /></instancedMesh>
    <mesh><sphereGeometry /><shaderMaterial /></mesh>
    <line><lineBasicMaterial /></line><color attach="background" args={['white']} />
    <ambientLight /><directionalLight /><spotLight />
    <Environment frames={1}><Lightformer form="ring" /><Lightformer form="rect" light={{ intensity: 1 }} /><Lightformer form="box" /></Environment>
    <Line points={[[0, 0, 0], [1, 1, 1]]} />
    <Html occlude="blending"><span>scene label</span></Html>
    <OrbitControls />
    {createPortal(<group name="portal"><cubeCamera args={[.1, 1000]} /></group>, portal)}
  </SceneCanvas>);
  expect(states.length).toBeGreaterThan(0);
  expect(portal.getObjectByName('portal')?.children[0].type).toBe('CubeCamera');
  expect(document.body.textContent).toContain('scene label');
  expect(renderers[0].render).toHaveBeenCalled(); // Environment's actual cube capture.
});

it('bridges outer context updates and keeps camera/root across hidden size and StrictMode replay', async () => {
  const mounted = vi.fn(), cleaned = vi.fn(), rendered = vi.fn();
  function Lifecycle() { rendered(); useEffect(() => { mounted(); return cleaned; }, []); return <Probe />; }
  const view = (value: string) => <StrictMode><Context value={value}>
    <SceneCanvas gl={makeRenderer} frameloop="never" camera={{ position: [3, 4, 5], up: [0, 0, 1] }}><Lifecycle /></SceneCanvas>
  </Context></StrictMode>;
  await paint(view('first'));
  expect(renderers).toHaveLength(1);
  const state = states.at(-1)!; const camera = state.camera;
  expect(state.scene.getObjectByName('probe:first')).toBeTruthy();
  expect(rendered.mock.calls.length).toBeGreaterThan(1);
  camera.position.set(40, 50, 60);
  await paint(view('second'));
  await resize(0, 0);
  await resize(700, 500);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(states.at(-1)!.camera).toBe(camera);
  expect(camera.position.toArray()).toEqual([40, 50, 60]);
  expect(state.scene.getObjectByName('probe:second')).toBeTruthy();
  expect(renderers[0].forceContextLoss).not.toHaveBeenCalled();
  await paint(null);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
  await paint(view('remounted'));
  expect(renderers).toHaveLength(2);
  expect(states.at(-1)!.camera).not.toBe(camera);
  expect(cleaned).toHaveBeenCalled();
});

it('uses the latest children when async configure finishes and disposes cancelled setup', async () => {
  let resolve!: (gl: WebGLRenderer) => void;
  let pendingCanvas!: HTMLCanvasElement;
  const delayed = vi.fn(({ canvas }: { canvas: HTMLCanvasElement | OffscreenCanvas }) => {
    pendingCanvas = canvas as HTMLCanvasElement;
    return new Promise<WebGLRenderer>((done) => { resolve = done; });
  });
  const view = (name: string) => <SceneCanvas gl={delayed} frameloop="never"><Probe name={name} /></SceneCanvas>;
  await paint(view('old'));
  await paint(view('latest'));
  await act(async () => { resolve(renderer(pendingCanvas) as unknown as WebGLRenderer); });
  expect(delayed).toHaveBeenCalledTimes(1);
  expect(states.at(-1)!.scene.getObjectByName('latest:initial')).toBeTruthy();
  expect(states.at(-1)!.scene.getObjectByName('old:initial')).toBeUndefined();
  await paint(null);
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  states.length = 0;
  await paint(view('cancelled'));
  await paint(null);
  await act(async () => { resolve(renderer(pendingCanvas) as unknown as WebGLRenderer); });
  await act(async () => { await new Promise((done) => setTimeout(done, 550)); });
  expect(states).toHaveLength(0);
  expect(renderers.at(-1)!.forceContextLoss).toHaveBeenCalledTimes(1);
});

it('relays configure rejection to the existing outer recovery boundary', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await paint(<Boundary><SceneCanvas gl={async () => { throw new Error('renderer setup failed'); }}><Probe /></SceneCanvas></Boundary>);
  expect(container.textContent).toBe('renderer setup failed');
  expect(states).toHaveLength(0);
});

it('relays scene suspension outward and resumes the same root after asset resolution', async () => {
  let ready = false, resolve!: () => void;
  const waiting = new Promise<void>((done) => { resolve = done; });
  function Asset() { if (!ready) throw waiting; return <Probe name="loaded" />; }
  await paint(<Suspense fallback={<output>loading asset</output>}><SceneCanvas gl={makeRenderer} frameloop="never"><Asset /></SceneCanvas></Suspense>);
  expect(container.textContent).toContain('loading asset');
  await act(async () => { ready = true; resolve(); });
  await paint(<Suspense fallback={<output>loading asset</output>}><SceneCanvas gl={makeRenderer} frameloop="never"><Asset /></SceneCanvas></Suspense>);
  expect(states.at(-1)!.scene.getObjectByName('loaded:initial')).toBeTruthy();
  expect(renderers).toHaveLength(1);
  expect(renderers[0].forceContextLoss).not.toHaveBeenCalled();
});

it('preserves DOM/ref/event coordinates, live missed callbacks and capture canvas identity', async () => {
  const target = document.createElement('div'); document.body.append(target);
  const ref = React.createRef<HTMLCanvasElement>();
  const first = vi.fn(), second = vi.fn(), onCreated = vi.fn();
  const view = (missed: (event: MouseEvent) => void) => <SceneCanvas
    ref={ref} gl={makeRenderer} frameloop="never" eventSource={target} eventPrefix="client"
    onPointerMissed={missed} onCreated={onCreated} className="existing-canvas"
    aria-label="Existing scene" style={{ touchAction: 'pan-y', overflow: 'visible' }}
    fallback={<span>WebGL fallback</span>}
  ><Probe /></SceneCanvas>;
  await paint(view(first));
  const state = states.at(-1)!;
  expect(state.events.connected).toBe(target);
  expect(onCreated).toHaveBeenCalledTimes(1);
  expect(ref.current).toBe(state.gl.domElement);
  expect(container.firstElementChild?.getAttribute('aria-label')).toBe('Existing scene');
  expect((container.firstElementChild as HTMLElement).style.pointerEvents).toBe('none');
  expect((container.firstElementChild as HTMLElement).style.overflow).toBe('visible');
  expect(ref.current!.textContent).toBe('WebGL fallback');
  state.events.compute!({ clientX: 160, clientY: 120 } as never, state);
  expect(state.pointer.toArray()).toEqual([-.5, .5]);
  await paint(view(second));
  state.onPointerMissed!(new MouseEvent('click'));
  expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1);
  const capture = vi.spyOn(ref.current!, 'toDataURL').mockReturnValue('data:image/png;base64,captured');
  expect(state.gl.domElement.toDataURL('image/png')).toBe('data:image/png;base64,captured');
  expect(capture).toHaveBeenCalledWith('image/png');
  target.remove();
});

it.each([
  { name: 'Workbench perspective', props: {}, loop: 'always', orthographic: false, shadows: false },
  { name: 'Workbench top', props: { orthographic: true }, loop: 'always', orthographic: true, shadows: false },
  { name: 'Studio house', props: { shadows: true, frameloop: 'demand', dpr: [1, 1.5] }, loop: 'demand', orthographic: false, shadows: true },
  { name: 'Studio quote', props: { shadows: true, frameloop: 'demand', dpr: 1.5 }, loop: 'demand', orthographic: false, shadows: true },
  { name: 'Studio composition', props: { shadows: 'percentage', frameloop: 'demand', dpr: [1, 1.5] }, loop: 'demand', orthographic: false, shadows: 'percentage' },
  { name: 'Website', props: { shadows: false, frameloop: 'demand', dpr: [1, 1.25] }, loop: 'demand', orthographic: false, shadows: false },
])('retains $name root configuration and camera values', async ({ props, loop, orthographic, shadows }) => {
  await paint(<SceneCanvas {...props as CanvasProps} gl={makeRenderer}
    camera={{ position: [10000, 16000, 10000], up: [0, 0, 1], near: 10, far: 200000, fov: 24 }}
  ><Probe /></SceneCanvas>);
  const state = states.at(-1)!;
  expect(state.frameloop).toBe(loop);
  expect('isOrthographicCamera' in state.camera).toBe(orthographic);
  expect(state.camera.position.toArray()).toEqual([10000, 16000, 10000]);
  expect(state.camera.up.toArray()).toEqual([0, 0, 1]);
  expect([state.camera.near, state.camera.far]).toEqual([10, 200000]);
  expect(state.gl.shadowMap.enabled).toBe(!!shadows);
  expect(state.gl.shadowMap.type).toBe(shadows === 'percentage' ? PCFShadowMap : PCFSoftShadowMap);
  if (typeof props.dpr === 'number') expect(state.viewport.dpr).toBe(props.dpr);
});

it('pauses actual root and context updates while inactive and reveals latest inputs in the same mounted camera frame', async () => {
  const updates=vi.spyOn(SceneRootLifecycle.prototype,'update');
  const oldMiss=vi.fn(), latestMiss=vi.fn(), mounted=vi.fn(), cleaned=vi.fn();
  function Content({name}:{name:string}) { useEffect(()=>{mounted();return cleaned;},[]); return <><Probe name={name}/><Html><span data-model-label>{name}</span></Html></>; }
  const view=(active:boolean,value:string,missed=oldMiss)=> <StrictMode><Context value={value}>
    <SceneCanvas active={active} gl={makeRenderer} frameloop="never" onPointerMissed={missed} dpr={value==='latest'?1.25:1}>
      <Content name={value}/>
    </SceneCanvas>
  </Context></StrictMode>;
  await paint(view(true,'first'));
  const state=states.at(-1)!, camera=state.camera, canvas=state.gl.domElement;
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  act(()=>state.advance(1,true));
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('');
  camera.position.set(40,50,60);
  const before=updates.mock.calls.length, mounts=mounted.mock.calls.length, cleanups=cleaned.mock.calls.length;
  await paint(view(false,'hidden-A'));
  await paint(view(false,'hidden-B'));
  await resize(720,510);
  await paint(view(false,'latest',latestMiss));
  expect(updates).toHaveBeenCalledTimes(before);
  expect(state.scene.getObjectByName('first:first')).toBeTruthy();
  expect(state.scene.getObjectByName('latest:latest')).toBeUndefined();
  expect(container.querySelector('[data-model-label]')?.textContent).toBe('first');
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  // An old queued demand frame cannot reveal the previous buffer while paused.
  act(()=>state.advance(2,true));
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  await paint(view(true,'latest',latestMiss));
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  expect(container.querySelector('[data-model-label]')?.textContent).toBe('latest');
  expect(state.get().size.width).toBe(720);
  expect(state.get().viewport.dpr).toBe(1.25);
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  state.onPointerMissed!(new MouseEvent('click'));
  expect(oldMiss).not.toHaveBeenCalled();expect(latestMiss).toHaveBeenCalledTimes(1);
  const latestDraw=vi.fn(()=>{expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('');});
  renderers[0].render.mockImplementationOnce(latestDraw);
  act(()=>state.advance(3,true));
  expect(latestDraw).toHaveBeenCalledTimes(1);
  expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('');
  expect(states.at(-1)!.camera).toBe(camera);
  expect(camera.position.toArray()).toEqual([40,50,60]);
  expect(renderers).toHaveLength(1);
  expect(mounted).toHaveBeenCalledTimes(mounts);expect(cleaned).toHaveBeenCalledTimes(cleanups);
  expect(container.querySelector('[active]')).toBeNull();
  for(const [i,value] of ['again','final'].entries()) {
    const count=updates.mock.calls.length;
    await paint(view(false,'discarded'));
    await paint(view(false,value));
    expect(updates).toHaveBeenCalledTimes(count);
    await paint(view(true,value));
    expect(state.scene.getObjectByName(`${value}:${value}`)).toBeTruthy();
    act(()=>state.advance(4+i,true));
    expect((canvas.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('');
    expect(state.camera).toBe(camera);
  }
  await paint(null);
  await act(async()=>{await new Promise(done=>setTimeout(done,550));});
  expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
  expect(cleaned).toHaveBeenCalledTimes(cleanups+1);
});

it('initializes once while initially inactive, freezes actual context values, then reveals the latest scene', async () => {
  const updates=vi.spyOn(SceneRootLifecycle.prototype,'update');
  const view=(active:boolean,value:string)=><Context value={value}><SceneCanvas active={active} gl={makeRenderer} frameloop="never"><Probe name={value}/></SceneCanvas></Context>;
  await paint(view(false,'initial'));
  const state=states.at(-1)!, camera=state.camera, count=updates.mock.calls.length;
  expect(renderers).toHaveLength(1);
  expect((state.gl.domElement.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  await paint(view(false,'hidden'));
  expect(updates).toHaveBeenCalledTimes(count);
  expect(state.scene.getObjectByName('initial:initial')).toBeTruthy();
  await paint(view(true,'latest'));
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  expect((state.gl.domElement.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
  act(()=>state.advance(1,true));
  expect((state.gl.domElement.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('');
  expect(state.camera).toBe(camera);expect(renderers).toHaveLength(1);
});

it.each([false,true])('retains error recovery and suspended-root identity with opt-in active=%s', async active => {
  let ready=false,resolve!:()=>void;
  const waiting=new Promise<void>(done=>{resolve=done;});
  function Asset(){if(!ready)throw waiting;return <Probe name="loaded"/>;}
  const view=(shown:boolean)=><Suspense fallback={<output>loading asset</output>}><SceneCanvas active={shown} gl={makeRenderer} frameloop="never"><Asset/></SceneCanvas></Suspense>;
  await paint(view(active));
  expect(container.textContent).toContain('loading asset');
  await act(async()=>{ready=true;resolve();});
  await paint(view(true));
  expect(states.at(-1)!.scene.getObjectByName('loaded:initial')).toBeTruthy();
  expect(renderers).toHaveLength(1);
  expect(renderers[0].forceContextLoss).not.toHaveBeenCalled();
  await paint(null);
  vi.spyOn(console,'error').mockImplementation(()=>{});
  await paint(<Boundary><SceneCanvas active={active} gl={async()=>{throw Error('opt-in renderer failed');}}><Probe/></SceneCanvas></Boundary>);
  expect(container.textContent).toBe('opt-in renderer failed');
});

it('keeps the exact inspector context objects and callbacks through a pause and reveal', async () => {
  const first=vi.fn(),latest=vi.fn();
  const Inspector=createContext({selected:'old-opening',choose:first});
  let current:React.ContextType<typeof Inspector>|null=null;
  function InspectorProbe(){current=useContext(Inspector);return <Probe/>;}
  const old={selected:'old-opening',choose:first}, next={selected:'new-opening',choose:latest};
  const view=(active:boolean,value:typeof old)=><Inspector value={value}><SceneCanvas active={active} gl={makeRenderer} frameloop="never"><InspectorProbe/></SceneCanvas></Inspector>;
  await paint(view(true,old));
  expect(current).toBe(old);
  await paint(view(false,next));
  expect(current).toBe(old);
  await paint(view(true,next));
  expect(current).toBe(next);
  current!.choose();
  expect(latest).toHaveBeenCalledTimes(1);expect(first).not.toHaveBeenCalled();
});


it.each([
  { initial: false, drawInitial: false },
  { initial: false, drawInitial: true },
  { initial: true, drawInitial: false },
  { initial: true, drawInitial: true },
])('completes an owned reveal after active omission from $initial, initial draw=$drawInitial', async ({initial,drawInitial}) => {
  const view=(active:boolean|undefined,name:string)=><StrictMode><Context value={name}>
    <SceneCanvas active={active} gl={makeRenderer} frameloop="never"><Probe name={name}/></SceneCanvas>
  </Context></StrictMode>;
  await paint(view(initial,'first'));
  const state=states.at(-1)!,camera=state.camera,surface=state.gl.domElement.parentElement!.parentElement! as HTMLElement;
  camera.position.set(40,50,60);
  if(drawInitial)act(()=>state.advance(1,true));
  const pending=surface.style.visibility==='hidden';
  await paint(view(undefined,'latest'));
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  if(pending)expect(surface.style.visibility).toBe('hidden');
  act(()=>state.advance(2,true));
  expect(surface.style.visibility).toBe('');
  expect(state.camera).toBe(camera);expect(camera.position.toArray()).toEqual([40,50,60]);expect(renderers).toHaveLength(1);
  await paint(view(undefined,'ordinary-update'));
  expect(surface.style.visibility).toBe('');
  expect(state.scene.getObjectByName('ordinary-update:ordinary-update')).toBeTruthy();
});

it.each([undefined,'visible','hidden','collapse'] as const)(
  'restores latest caller visibility %s after a paused style change and omitted active', async visibility => {
    const view=(active:boolean|undefined,name:string,value:typeof visibility)=><Context value={name}>
      <SceneCanvas active={active} style={{visibility:value}} gl={makeRenderer} frameloop="never"><Probe name={name}/></SceneCanvas>
    </Context>;
    await paint(view(true,'first','visible'));
    const state=states.at(-1)!,surface=state.gl.domElement.parentElement!.parentElement! as HTMLElement;
    act(()=>state.advance(1,true));
    expect(surface.style.visibility).toBe('visible');
    await paint(view(false,'paused',visibility));
    expect(surface.style.visibility).toBe('hidden');
    await paint(view(undefined,'latest',visibility));
    expect(surface.style.visibility).toBe('hidden');
    expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
    act(()=>state.advance(2,true));
    expect(surface.style.visibility).toBe(visibility??'');
    expect(renderers).toHaveLength(1);
  },
);

it('keeps one pending reveal through omission, re-pause before drawing and a second omission', async () => {
  const view=(active:boolean|undefined,name:string)=><Context value={name}><SceneCanvas active={active} gl={makeRenderer} frameloop="never"><Probe name={name}/></SceneCanvas></Context>;
  await paint(view(false,'first'));
  const state=states.at(-1)!,camera=state.camera,surface=state.gl.domElement.parentElement!.parentElement! as HTMLElement;
  await paint(view(undefined,'discarded'));
  expect(surface.style.visibility).toBe('hidden');
  await paint(view(false,'paused-again'));
  act(()=>state.advance(1,true));
  expect(surface.style.visibility).toBe('hidden');
  await paint(view(undefined,'latest'));
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  expect(surface.style.visibility).toBe('hidden');
  act(()=>state.advance(2,true));
  expect(surface.style.visibility).toBe('');
  expect(state.camera).toBe(camera);expect(renderers).toHaveLength(1);
});

it.each([false,true])('invalidates the old committed observer across zero-size reveal from initial%s', async initial => {
  const view=(active:boolean|undefined,name:string)=><Context value={name}><SceneCanvas active={active} gl={makeRenderer} frameloop="never"><Probe name={name}/></SceneCanvas></Context>;
  await paint(view(initial,'old'));
  const state=states.at(-1)!,camera=state.camera,surface=state.gl.domElement.parentElement!.parentElement! as HTMLElement;
  if(initial)act(()=>state.advance(1,true));
  camera.position.set(40,50,60);
  await paint(view(false,'paused'));
  await resize(0,0);
  await paint(view(undefined,'latest'));
  const stages=[surface.style.visibility];
  expect(state.scene.getObjectByName('latest:latest')).toBeUndefined();
  act(()=>state.advance(2,true));stages.push(surface.style.visibility);
  await resize(720,510);
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  expect(state.get().size).toMatchObject({width:720,height:510});
  stages.push(surface.style.visibility);
  act(()=>state.advance(3,true));stages.push(surface.style.visibility);
  expect(stages).toEqual(['hidden','hidden','hidden','']);
  expect(state.camera).toBe(camera);expect(camera.position.toArray()).toEqual([40,50,60]);expect(renderers).toHaveLength(1);
});

it('retains latest omitted-active inputs and callback when an initially inactive renderer configures asynchronously', async () => {
  let resolve!:(gl:WebGLRenderer)=>void,pendingCanvas!:HTMLCanvasElement;
  const first=vi.fn(),latest=vi.fn();
  const delayed=({canvas}:{canvas:HTMLCanvasElement|OffscreenCanvas})=>{
    pendingCanvas=canvas as HTMLCanvasElement;
    return new Promise<WebGLRenderer>(done=>{resolve=done;});
  };
  const view=(active:boolean|undefined,name:string,created:typeof first)=><Context value={name}><SceneCanvas active={active} gl={delayed} frameloop="never" onCreated={created}><Probe name={name}/></SceneCanvas></Context>;
  await paint(view(false,'old',first));
  await paint(view(undefined,'latest',latest));
  await act(async()=>resolve(renderer(pendingCanvas) as unknown as WebGLRenderer));
  const state=states.at(-1)!,surface=state.gl.domElement.parentElement!.parentElement! as HTMLElement;
  expect(state.scene.getObjectByName('latest:latest')).toBeTruthy();
  expect(first).not.toHaveBeenCalled();expect(latest).toHaveBeenCalledTimes(1);
  expect(surface.style.visibility).toBe('hidden');
  act(()=>state.advance(1,true));
  expect(surface.style.visibility).toBe('');expect(renderers).toHaveLength(1);
});


it.each([false,true])('bootstraps initial bounds without any ResizeObserver delivery, Strict replay=%s',async strict=>{
 const node=<SceneCanvas active gl={makeRenderer} frameloop="never" camera={{position:[3,4,5]}}><Probe name="fresh-no-RO"/></SceneCanvas>;
 await act(async()=>{dom.render(strict?<StrictMode>{node}</StrictMode>:node);});
 await act(async()=>{await new Promise(done=>setTimeout(done,30));});
 // Observe is installed, but this test deliberately never calls any callback.
 expect(observers.size).toBeGreaterThan(0);expect(renderers).toHaveLength(1);
 const state=states.at(-1)!;expect(state.size.width).toBe(640);expect(state.size.height).toBe(480);
 expect(state.scene.getObjectByName('fresh-no-RO:initial')).toBeTruthy();
 expect(state.camera.position.toArray()).toEqual([3,4,5]);
 expect((state.gl.domElement.parentElement!.parentElement! as HTMLElement).style.visibility).toBe('hidden');
 expect(renderers[0].render).not.toHaveBeenCalled();
});
it('keeps initial zero-size unconfigured and accepts the later real observer size through the same owner',async()=>{
 size={width:0,height:0};await act(async()=>{dom.render(<SceneCanvas active gl={makeRenderer} frameloop="never"><Probe/></SceneCanvas>);});
 await act(async()=>{await new Promise(done=>setTimeout(done,30));});expect(renderers).toHaveLength(0);
 await resize(720,510);expect(renderers).toHaveLength(1);expect(states.at(-1)!.size.width).toBe(720);expect(states.at(-1)!.size.height).toBe(510);
});
