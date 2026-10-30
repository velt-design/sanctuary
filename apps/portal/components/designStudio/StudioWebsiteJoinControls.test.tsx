import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {JoinPriceRecovery} from './StudioWebsiteJoinControls';
import StudioWebsiteJoinControls from './StudioWebsiteJoinControls';
import * as joins from '@/lib/designStudio/websiteJoins';
import {addWebsitePergola} from '@/lib/designStudio/websiteComposition';
import {EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT} from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type {StudioAuthoringEdit} from '@/lib/designStudio/authoringView';
import {renderIntoDocument} from '../../../../test/reactHarness';
import {useStudioJoinTask} from './useStudioJoinTask';
import type {StudioJoinReadout} from './studioJoinPresentation';
vi.mock('@sp/configurator/react/controls',()=>({useLighting:()=>null}));
it('does not recompute canonical join states for unchanged presentation renders',()=>{
 let edit:StudioAuthoringEdit={schemaVersion:'studio_authoring_edit.v1',designId:'join-boundary',revision:1,spatial:structuredClone(EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT),site:{},objectOptions:[],deletions:[]};
 edit=addWebsitePergola(addWebsitePergola(edit,'a'),'b');
 function Harness(){const task=useStudioJoinTask({edit,identity:{scopeKey:'scope',epoch:'one',generation:0},objectId:'b',active:true,navigate:()=>{},apply:()=>{},change:()=>{}});return <StudioWebsiteJoinControls view={task.panel} onIntent={task.dispatch}/>;}
 const render=()=> <Harness/>;
 const mounted=renderIntoDocument(render()),calls=vi.spyOn(joins,'websiteJoinStates');
 try { for(let i=0;i<3;i++)mounted.rerender(render());expect(calls).not.toHaveBeenCalled(); }
 finally {mounted.unmount();calls.mockRestore();}
});
it('renders a plain controlled readout and sends join choices without an edit or geometry owner',()=>{
 const onIntent=vi.fn(),view:StudioJoinReadout={objectId:'selected',states:[{id:'existing',label:'Exact canonical label',error:'Exact canonical refusal',canReposition:false}],movingAttached:false,canStart:true,canCommit:false,error:'Current refusal',draft:{movingLabel:'Moving product',edge:'left',alignment:'centre',hasTarget:true,targetLabel:'Target product',targetEdge:'right'}};
 const m=renderIntoDocument(<StudioWebsiteJoinControls view={view} onIntent={onIntent} focused/>);
 try {
  expect(document.activeElement?.textContent).toBe('Pergola joins');expect(m.container.textContent).toContain('Moving product · left → Target product · right');
  expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Reposition to join')!.disabled).toBe(true);
  expect([...m.container.querySelectorAll('button')].find(b=>b.textContent==='Join')).toBeUndefined();
  const edge=m.container.querySelector<HTMLSelectElement>('[aria-label="Moving pergola edge"]')!;
  act(()=>{edge.value='rear';edge.dispatchEvent(new Event('change',{bubbles:true}));});expect(onIntent).toHaveBeenLastCalledWith({kind:'edge',edge:'rear'});
  act(()=>[...m.container.querySelectorAll('button')].find(b=>b.textContent==='Cancel join')!.click());expect(onIntent).toHaveBeenLastCalledWith({kind:'cancel'});
 } finally {m.unmount();}
});
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
