import {afterEach,expect,it} from 'vitest';
import type {GeometryPlanViewModel,RoofPlane3D} from '@sp/geometry';
import {renderIntoDocument} from '../../../../../test/reactHarness';
import PreviewPlanProduct from './PreviewPlanProduct';

const boundary=[{x:0,y:0,z:2400},{x:6000,y:0,z:2400},{x:6000,y:3000,z:2300},{x:0,y:3000,z:2300}];
const plan={outline:boundary,members:{rafters:[],beams:[],ledgers:[],gutters:[],joiners:[],ridge:[],posts:[]}} as unknown as GeometryPlanViewModel;
const roofPlanes=[{id:'slope',boundary,fallVector:{x:0,y:1,z:0}}] as RoofPlane3D[];
let mounted:ReturnType<typeof renderIntoDocument>|undefined;
afterEach(()=>{mounted?.unmount();mounted=undefined;});
const arrowLength=()=>{const numbers=mounted!.container.querySelector('[data-roof-fall] path')!.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number);return Math.hypot(numbers[2]-numbers[0],numbers[3]-numbers[1]);};

it('keeps default marketing/quote arrow sizes and label behaviour when Studio does not opt in',()=>{
 mounted=renderIntoDocument(<svg><PreviewPlanProduct plan={plan} roofPlanes={roofPlanes} scale={.065}/></svg>);
 expect(arrowLength()).toBeCloseTo(44/.065,7);expect(mounted.container.querySelector('[data-roof-fall] text')!.textContent).toBe('Roof fall');
 expect(mounted.container.querySelector('[data-roof-fall] title')).toBeNull();
 const before=mounted.container.innerHTML;
 mounted.rerender(<svg><PreviewPlanProduct plan={plan} roofPlanes={roofPlanes} scale={.065} roofFallScale={NaN}/></svg>);
 expect(mounted.container.innerHTML).toBe(before);
});

it.each([1,15,80])('renders a compact accessible Studio fall arrow at constant screen size for %s world-units per pixel',units=>{
 mounted=renderIntoDocument(<svg><PreviewPlanProduct plan={plan} roofPlanes={roofPlanes} scale={.065} showRoofFallLabel={false}/></svg>);
 const product=mounted.container.querySelector('svg>g')!.outerHTML;
 mounted.rerender(<svg><PreviewPlanProduct plan={plan} roofPlanes={roofPlanes} scale={.065} showRoofFallLabel={false} compact roofFallScale={1/units}/></svg>);
 expect(mounted.container.querySelector('svg>g')!.outerHTML).toBe(product);
 expect(arrowLength()/units).toBeCloseTo(28,7);
 const arrow=mounted.container.querySelector('[data-roof-fall]')!;
 expect(Number(arrow.getAttribute('stroke-width'))/units).toBe(1);expect(arrow.getAttribute('pointer-events')).toBe('none');
 expect(arrow.getAttribute('aria-label')).toBe('Roof fall');expect(arrow.querySelector('title')!.textContent).toBe('Roof fall');expect(arrow.querySelector('text')).toBeNull();
});
