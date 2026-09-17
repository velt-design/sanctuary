import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import PreviewScene from './PreviewScene';

const fixture=vi.hoisted(()=>({canvas:null as HTMLCanvasElement|null,fail:false}));
vi.mock('@react-three/fiber',()=>({
  Canvas:({children}:{children:React.ReactNode})=>{if(fixture.fail)throw new Error('renderer unavailable');return <div data-scene>{children}</div>;},
  useThree:()=>({gl:{domElement:fixture.canvas}}),
}));
vi.mock('./LightingProvider',()=>({useLighting:()=>null}));
vi.mock('./PreviewBlindProvider',()=>({usePreviewBlinds:()=>null}));
vi.mock('./PreviewCamera',()=>({default:()=>null}));
vi.mock('./DayNightTransition',()=>({default:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('./PreviewLighting',()=>({default:()=>null}));
vi.mock('@sp/geometry-viewer',()=>({computeSceneBoundsFromPoints:()=>({})}));
vi.mock('@sp/geometry-viewer/react',()=>({SceneObjectNode:()=>null}));

it.each(['context loss','render error'])('can retry after %s without resetting the parent design',async(reason)=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
  fixture.canvas=document.createElement('canvas');fixture.fail=false;
  const host=document.createElement('div'),root=createRoot(host);
  let fallbackCount=0;
  function Harness(){
    const [selection,setSelection]=React.useState('original');
    return <><button onClick={()=>setSelection('custom design')}>Customise</button><output>{selection}</output>
      <PreviewScene scene={{layers:[]} as unknown as React.ComponentProps<typeof PreviewScene>['scene']}
        plan={{} as React.ComponentProps<typeof PreviewScene>['plan']} context={null} activeDimension={null}
        interactive={false} reset={0} fit={0} onFallback={()=>{fallbackCount++;}}/></>;
  }
  try{
    await React.act(async()=>root.render(<Harness/>));
    await React.act(async()=>host.querySelector('button')!.click());
    if(reason==='context loss')await React.act(async()=>{fixture.canvas!.dispatchEvent(new Event('webglcontextlost'));});
    else{fixture.fail=true;await React.act(async()=>root.render(<Harness/>));}
    expect(host.textContent).toContain('Your selections are still here');
    expect(host.querySelector('[data-scene]')).toBeNull();
    if(reason==='context loss')expect(fallbackCount).toBe(1);
    fixture.fail=false;
    await React.act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Try 3D again')!.click());
    expect(host.querySelector('[data-scene]')).not.toBeNull();
    expect(host.querySelector('output')!.textContent).toBe('custom design');
  }finally{await React.act(async()=>root.unmount());errors.mockRestore();vi.unstubAllGlobals();}
});
