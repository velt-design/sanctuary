import { act } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import Frame from './ProjectPageFrameSurface';
import {useProjectTabSelection} from './useProjectTabSelection';
import {selectProjectView} from './projectViewNavigation';

let query = 'tab=activity';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(query) }));

function Page({ label = 'Overview', calculator = false, projectId='workdesk-regression', portal=false }: {label?: string; calculator?: boolean;projectId?:string;portal?:boolean}) {
  return <main data-project-id={projectId}><Frame projectId={projectId} calculatorWorkspace={calculator} header={<header><button>Overview</button><button>Files</button><button>Commercial</button></header>}><article>{label}<input aria-label="Work input"/></article>{portal ? createPortal(<div role="dialog"><input aria-label="Dialog input"/></div>,document.body):null}</Frame></main>;
}
function HistoryPage(){
 const navigation=useProjectTabSelection('workdesk-history','invoices',false);
 return <main><Frame projectId="workdesk-history" selectedTab={navigation.activeTab} header={<header><button onClick={()=>{selectProjectView('files');navigation.selectTab('files');}}>Files</button></header>}><article data-project-active-tab={navigation.activeTab}>{navigation.activeTab}</article></Frame></main>;
}
function wheelTo(node:HTMLElement,top:number){node.dispatchEvent(new WheelEvent('wheel',{bubbles:true}));node.scrollTop=top;node.dispatchEvent(new Event('scroll'));}

describe('project work-area position ownership', () => {
  afterEach(() => { document.body.innerHTML = ''; query='tab=activity'; window.history.replaceState(null,'','/'); });

  it('keeps the actual frame, heading and nav mounted while restoring independent view positions', () => {
    const view=renderIntoDocument(<Page/>);
    const frame=view.container.querySelector('[data-project-page-frame]');
    const header=view.container.querySelector('header');
    const nav=header?.querySelector('button');
    const work=view.container.querySelector<HTMLElement>('[data-project-workspace-scroll]')!;
    Object.defineProperties(work,{scrollHeight:{configurable:true,value:1800},clientHeight:{configurable:true,value:600}});
    act(()=>wheelTo(work,312));
    query='tab=files';view.rerender(<Page label="Files"/>);
    expect(work.scrollTop).toBe(0);
    expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame);
    expect(view.container.querySelector('header')).toBe(header);
    expect(header?.querySelector('button')).toBe(nav);
    query='tab=activity';view.rerender(<Page/>);
    expect(work.scrollTop).toBe(312);
    query='tab=quotes';view.rerender(<Page label="Quotes"/>);
    act(()=>wheelTo(work,145));
    query='tab=invoices';view.rerender(<Page label="Invoices"/>);
    expect(work.scrollTop).toBe(0);
    query='tab=quotes';view.rerender(<Page label="Quotes"/>);
    expect(work.scrollTop).toBe(145);
    view.unmount();
  });

  it('leaves the existing Calculator workspace outside the Work desk scroll boundary',()=>{
    const view=renderIntoDocument(<Page calculator/>);
    expect(view.container.querySelector('[data-project-workspace-scroll]')).toBeNull();
    expect(view.container.querySelector('main')?.style.getPropertyValue('--project-workdesk-page-height')).toBe('');
    view.unmount();
  });
  it('keeps restoration owned by the work area when a portalled dialog receives input',()=>{
    const view=renderIntoDocument(<Page portal projectId="portal-input-boundary"/>);
    const node=view.container.querySelector<HTMLElement>('[data-project-workspace-scroll]')!;
    Object.defineProperties(node,{scrollHeight:{configurable:true,value:1800},clientHeight:{configurable:true,value:600}});
    act(()=>wheelTo(node,312));
    query='tab=files';view.rerender(<Page portal projectId="portal-input-boundary" label="Files"/>);
    query='tab=activity';view.rerender(<Page portal projectId="portal-input-boundary"/>);
    const dialogInput=document.querySelector<HTMLInputElement>('[aria-label="Dialog input"]')!;
    expect(node.contains(dialogInput)).toBe(false);
    for(const event of [new WheelEvent('wheel',{bubbles:true}),new Event('touchmove',{bubbles:true}),new Event('pointerdown',{bubbles:true}),new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}),new KeyboardEvent('keydown',{key:'a',bubbles:true})]){
      act(()=>{dialogInput.dispatchEvent(event);node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});
      expect(node.scrollTop).toBe(312);
    }
    const workInput=node.querySelector('input')!;
    act(()=>{workInput.focus();workInput.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));node.scrollTop=405;node.dispatchEvent(new Event('scroll'));});
    expect(node.scrollTop).toBe(405);
    query='tab=files';view.rerender(<Page portal projectId="portal-input-boundary" label="Files"/>);
    query='tab=activity';view.rerender(<Page portal projectId="portal-input-boundary"/>);
    expect(node.scrollTop).toBe(405);
    act(()=>{workInput.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));node.scrollTop=450;node.dispatchEvent(new Event('scroll'));});
    query='tab=files';view.rerender(<Page portal projectId="portal-input-boundary" label="Files"/>);
    query='tab=activity';view.rerender(<Page portal projectId="portal-input-boundary"/>);
    expect(node.scrollTop).toBe(450);
    view.unmount();
  });
  it('isolates two project identities even when their selected tab is identical',()=>{
    const view=renderIntoDocument(<Page projectId="workdesk-project-a"/>);
    const node=view.container.querySelector<HTMLElement>('[data-project-workspace-scroll]')!;
    Object.defineProperties(node,{scrollHeight:{configurable:true,value:1800},clientHeight:{configurable:true,value:600}});
    act(()=>wheelTo(node,277));
    view.rerender(<Page projectId="workdesk-project-b"/>);expect(node.scrollTop).toBe(0);
    act(()=>wheelTo(node,83));
    view.rerender(<Page projectId="workdesk-project-a"/>);expect(node.scrollTop).toBe(277);
    view.rerender(<Page projectId="workdesk-project-b"/>);expect(node.scrollTop).toBe(83);
    view.unmount();
  });
  it('restores native Back before delayed Next query adoption and rejects transition clamping',async()=>{
    query='tab=invoices';window.history.replaceState(null,'','/staff/projects/workdesk-history?tab=invoices');
    const view=renderIntoDocument(<HistoryPage/>),frame=view.container.querySelector('[data-project-page-frame]'),header=view.container.querySelector('header');
    const node=view.container.querySelector<HTMLElement>('[data-project-workspace-scroll]')!;
    Object.defineProperties(node,{scrollHeight:{configurable:true,value:1296},clientHeight:{configurable:true,value:578}});
    act(()=>wheelTo(node,718));
    act(()=>view.container.querySelector('button')!.click());
    expect(query).toBe('tab=invoices');expect(view.container.querySelector('article')?.textContent).toBe('files');
    act(()=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});
    await act(async()=>{window.history.back();await new Promise(resolve=>window.addEventListener('popstate',resolve,{once:true}));});
    expect(view.container.querySelector('article')?.textContent).toBe('invoices');expect(node.scrollTop).toBe(718);
    // A late history scroll or a stale query bridge must not erase real reading.
    act(()=>{node.scrollTop=0;node.dispatchEvent(new Event('scroll'));});expect(node.scrollTop).toBe(718);
    query='tab=files';view.rerender(<HistoryPage/>);expect(node.scrollTop).toBe(718);
    query='tab=invoices';view.rerender(<HistoryPage/>);expect(node.scrollTop).toBe(718);
    expect(view.container.querySelector('[data-project-page-frame]')).toBe(frame);expect(view.container.querySelector('header')).toBe(header);
    act(()=>wheelTo(node,405));expect(node.scrollTop).toBe(405);view.unmount();
  });
});
