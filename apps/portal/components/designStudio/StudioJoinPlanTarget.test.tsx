import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {JoinPlanTarget} from './StudioJoinPlanTarget';
vi.mock('@sp/configurator/react',()=>({}));
it('edge and label hits select the join without activating underlying placement, with keyboard parity',async()=>{
 const host=document.createElement('div'),root=createRoot(host),choose=vi.fn(),underlying=vi.fn();
 await act(async()=>root.render(<svg onPointerDown={underlying} onClick={underlying}><JoinPlanTarget target={{label:'Pergola 1 · front',start:{x:0,y:0},end:{x:0,y:3000}}} onChoose={choose}/></svg>));
 const target=host.querySelector('[role=button]')!,line=target.querySelector('line')!,label=target.querySelector('rect')!;
 expect(line.getAttribute('vector-effect')).toBe('non-scaling-stroke');expect(Number(line.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(24);
 expect(label.getAttribute('pointer-events')).toBe('all');
 await act(async()=>{for(const hit of [line,label]){hit.dispatchEvent(new Event('pointerdown',{bubbles:true}));hit.dispatchEvent(new MouseEvent('click',{bubbles:true}));}target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));target.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));});
 expect(choose).toHaveBeenCalledTimes(4);expect(underlying).not.toHaveBeenCalled();
 await act(async()=>root.unmount());
});
