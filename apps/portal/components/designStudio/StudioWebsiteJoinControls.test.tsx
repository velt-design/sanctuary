import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {JoinPriceRecovery} from './StudioWebsiteJoinControls';
vi.mock('@sp/configurator/react/controls',()=>({useLighting:()=>null}));
it('routes deterministic join failure to repair and keeps retry for transient errors',async()=>{
 const host=document.createElement('div'),root=createRoot(host),check=vi.fn(),retry=vi.fn();
 await act(async()=>root.render(<JoinPriceRecovery invalidLabel="Pergola 2 right to Pergola 1 left" error="Unavailable" onCheck={check} onRetry={retry}/>));
 expect(host.textContent).toBe('Check join');
 await act(async()=>host.querySelector('button')!.click());expect(check).toHaveBeenCalledOnce();expect(retry).not.toHaveBeenCalled();
 await act(async()=>root.render(<JoinPriceRecovery error="Network unavailable" onCheck={check} onRetry={retry}/>));
 expect(host.textContent).toBe('Retry price');await act(async()=>host.querySelector('button')!.click());expect(retry).toHaveBeenCalledOnce();
 await act(async()=>root.render(<JoinPriceRecovery error={null} onCheck={check} onRetry={retry}/>));expect(host.querySelector('button')).toBeNull();
 await act(async()=>root.unmount());
});
