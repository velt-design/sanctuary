import {act} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {studioAttachmentFixture} from '../../../../test/studioAttachmentFixture';
import {createStudioSceneResolver} from '@/lib/designStudio/interaction/resolvedScene';
import StudioPlanHouse from './StudioPlanHouse';
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{mounted?.unmount();mounted=undefined;});

it('keeps the exact physical wall footprint as the single keyboard/pointer hit surface below noninteractive roof decoration',()=>{
 const geometry=createStudioSceneResolver().resolve(studioAttachmentFixture(37,'hipped')).houses[0],select=vi.fn(),start=vi.fn();
 mounted=renderIntoDocument(<svg><StudioPlanHouse geometry={geometry} selected unitsPerPixel={20} onSelect={select} onStartDrag={start}/></svg>);
 const hit=mounted.container.querySelector<SVGPolygonElement>('[role=button]')!;
 expect(hit.getAttribute('points')).toBe(geometry.footprint.map(p=>`${p.x},${p.y}`).join(' '));expect(hit.getAttribute('aria-pressed')).toBe('true');expect(mounted.container.querySelectorAll('[role=button]')).toHaveLength(1);
 for(const decoration of mounted.container.querySelectorAll('pattern,[data-house-roof-lines],path'))expect(decoration.closest('[pointer-events=none]')).not.toBeNull();
 expect(mounted.container.querySelector('path')!.getAttribute('vector-effect')).toBe('non-scaling-stroke');
 act(()=>hit.dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(select).toHaveBeenLastCalledWith(geometry.house.id);
 select.mockClear();act(()=>hit.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));expect(select).toHaveBeenCalledExactlyOnceWith(geometry.house.id);
 select.mockClear();act(()=>hit.dispatchEvent(new MouseEvent('pointerdown',{button:2,bubbles:true})));expect(select).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();
 act(()=>hit.dispatchEvent(new MouseEvent('pointerdown',{button:0,bubbles:true})));expect(select).toHaveBeenCalledExactlyOnceWith(geometry.house.id);expect(start).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({button:0}),geometry.house.id);
});

it('owns unique clipped slope patterns per house and leaves the house model unchanged',()=>{
 const geometry=createStudioSceneResolver().resolve(studioAttachmentFixture(0,'hipped')).houses[0],before=JSON.stringify(geometry);
 mounted=renderIntoDocument(<svg><StudioPlanHouse geometry={geometry} selected={false} unitsPerPixel={10} onSelect={()=>{}} onStartDrag={()=>{}}/><StudioPlanHouse geometry={geometry} selected unitsPerPixel={10} onSelect={()=>{}} onStartDrag={()=>{}}/></svg>);
 const patterns=[...mounted.container.querySelectorAll('pattern')];expect(patterns.length).toBeGreaterThan(0);expect(new Set(patterns.map(p=>p.id)).size).toBe(patterns.length);
 for(const face of mounted.container.querySelectorAll('[data-house-roof-lines]')){const id=face.getAttribute('fill')!.slice(5,-1);expect(patterns.some(p=>p.id===id)).toBe(true);}
 expect(JSON.stringify(geometry)).toBe(before);
});
