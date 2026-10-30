import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import ProjectHeaderActionsSurface from '../projects/ProjectPage/ProjectHeaderActionsSurface';
const fetchMock=vi.fn();
vi.mock('@/components/navigation/ProjectsIndexLink',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
let mount:ReturnType<typeof renderIntoDocument>|undefined;
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();});
afterEach(()=>{mount?.unmount();mount=undefined;vi.unstubAllGlobals();});
it('replaces only the Workbench entry with a gated Studio entry and retains private-content disabling',async()=>{
 let resolve!:(value:unknown)=>void;fetchMock.mockReturnValue(new Promise(r=>{resolve=r;}));
 mount=renderIntoDocument(<ProjectHeaderActionsSurface project={{id:'proj_synthetic'} as any} privateContentReady={false} privateActions={<button>Private action</button>}/>);
 const label=()=>Array.from(mount!.container.querySelectorAll('a,button')).find(node=>node.textContent==='Design Studio')!;
 expect(label().getAttribute('aria-disabled')).toBe('true');expect(mount.container.textContent).not.toContain('Workbench');expect(mount.container.textContent).not.toContain('Private action');
 await act(async()=>resolve({ok:true,json:async()=>({enabled:true})}));
 expect(label().getAttribute('aria-disabled')).toBe('true');
 mount.rerender(<ProjectHeaderActionsSurface project={{id:'proj_synthetic'} as any} privateContentReady privateActions={<button>Private action</button>}/>);
 expect(label().getAttribute('href')).toBe('/staff/projects/proj_synthetic/studio');expect(mount.container.textContent).toContain('Private action');expect(mount.container.textContent).toContain('Projects');
 expect(Array.from(mount.container.querySelectorAll('a')).filter(a=>a.textContent==='Design Studio')).toHaveLength(1);
});
it('hides the entry when server capability is off and aborts late capability completion after retirement',async()=>{
 fetchMock.mockResolvedValue({ok:true,json:async()=>({enabled:false})});
 mount=renderIntoDocument(<ProjectHeaderActionsSurface project={{id:'proj_synthetic'} as any}/>);await act(async()=>{});
 expect(mount.container.textContent).not.toContain('Design Studio');expect(mount.container.textContent).toContain('Projects');
 const signal=fetchMock.mock.calls[0][1].signal;mount.unmount();mount=undefined;expect(signal.aborted).toBe(true);
});
