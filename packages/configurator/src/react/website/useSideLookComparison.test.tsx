// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {useSideLookComparison} from './useSideLookComparison';
import {previewBlindOpenings} from '../../geometry';
it('treats staff raw intent as a custom bookmark even if valid selections equal a preset',async()=>{
 const input={widthMm:6000,projectionMm:3000,level:'ground' as const,connection:'facade' as const};
 const roof={family:'mono' as const,orientation:'parallel' as const,infills:false};
 const openings=previewBlindOpenings(input,roof);let result:ReturnType<typeof useSideLookComparison>;let changed:unknown;
 function Probe(){result=useSideLookComparison(roof,openings,next=>{changed=next;},true);return null;}
 const host=document.createElement('div'),root=createRoot(host);
 await act(async()=>{root.render(<Probe/>);});expect(result!.isCustom).toBe(true);expect(result!.hasCustom).toBe(true);
 await act(async()=>{result!.restore();});expect(changed).toEqual(roof);await act(async()=>root.unmount());
});
