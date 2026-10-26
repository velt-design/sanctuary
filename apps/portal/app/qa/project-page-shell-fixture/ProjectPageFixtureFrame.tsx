'use client';

import {memo,useCallback,useLayoutEffect,useMemo,useRef,useState,type ComponentProps} from 'react';
import type {ProjectSnapshotEvidence} from '../../staff/projects/[projectId]/ProjectSnapshotSurface';
import ProjectPageFrameSurface from '@/components/projects/ProjectPage/ProjectPageFrameSurface';
import ProjectHeaderSurface from '@/components/projects/ProjectPage/ProjectHeaderSurface';
import ProjectPageShellSurface from '@/components/projects/ProjectPage/ProjectPageShellSurface';
import {PageLayout} from '@/components/ui/foundation/FoundationSurfaces';
import projectStyles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import ProjectTabBody from '@/components/projects/ProjectPage/ProjectTabBody';
import {ProjectCommercialProvider} from '@/components/projects/ProjectPage/ProjectCommercialContext';
import {ProjectCorrespondenceWarmRead} from '@/components/projects/ProjectPage/tabs/overview/ProjectCorrespondenceWarmRead';
import ProjectOverviewSurface,{useOverviewControls,type OverviewBinding} from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import {useOwnedPortalPublication} from '@/components/page-state/PortalPageSource';
import {selectProjectView} from '@/components/projects/ProjectPage/projectViewNavigation';
import {currentProjectWork} from '@/lib/projects/projectCurrentStatus';
import type {ProjectPageSnapshot,ProjectSnapshotLoadState} from '@/lib/projects/types';
import { useSearchParams } from 'next/navigation';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import ProjectSnapshotNotice from '@/components/projects/ProjectPage/ProjectSnapshotNotice';
import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import { ProjectOverviewReadsProvider, useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';

type FixtureProps=Omit<ComponentProps<typeof ProjectPageFrame>, 'optimisticTab' | 'onTabSelect'>;
export default function ProjectPageFixtureFrame(props:FixtureProps){
 const params=useSearchParams();const overview=params.get('overview')==='1'&&(params.get('tab')??props.tab)==='activity';
 return overview?<OverviewFixtureFrame {...props}/>:<LegacyFixtureFrame {...props}/>;
}

function LegacyFixtureFrame(props: Omit<ComponentProps<typeof ProjectPageFrame>, 'optimisticTab' | 'onTabSelect'>) {
  const stateParam = useSearchParams().get('snapshotState');
  const stateOverride = stateParam === 'pending' || stateParam === 'summary' || stateParam === 'refresh-failed' || stateParam === 'fresh' ? stateParam : undefined;
  const snapshotState = stateOverride ?? props.snapshotState;
  const navigation = useProjectTabSelection(props.projectId ?? props.snapshot?.project.id ?? "", props.tab, stateOverride === 'pending' ? undefined : props.snapshot?.project.hasJobPacks);
  const reads = useProjectOverviewReads(props.host, props.projectId ?? props.snapshot?.project.id ?? "", navigation.activeTab === 'activity' && stateOverride !== 'pending');
  const retry = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('snapshotState', 'summary');
    window.history.replaceState(null, '', url);
  };
  return <ProjectOverviewReadsProvider value={reads}>
    <ProjectPageFrame {...props} optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab}
      projectId={props.projectId ?? props.snapshot?.project.id} snapshot={stateOverride === 'pending' ? null : props.snapshot} privateContentReady={stateOverride === 'pending' ? false : props.privateContentReady}
      snapshotState={snapshotState} snapshotContentReady={stateOverride ? stateOverride === 'fresh' : props.snapshotContentReady}
      statusPanel={stateOverride ? <ProjectSnapshotNotice state={stateOverride} onRetry={retry} /> : props.statusPanel} />
  </ProjectOverviewReadsProvider>;
}


/** Controlled fictional publication through the SAME production surface and body. */
function OverviewFixtureFrame(props:FixtureProps){
 const params=useSearchParams(),requested=params.get('snapshotState');
 const state:ProjectSnapshotLoadState=requested==='pending'||requested==='summary'||requested==='refresh-failed'||requested==='fresh'?requested:props.snapshotState??'fresh';
 const projectId=props.projectId??props.snapshot?.project.id??'',pending=state==='pending';
 const [denied,setDenied]=useState(false);
 const owner=useMemo(()=>pending||denied?null:{},[projectId,pending,denied]);
 const publication=useOwnedPortalPublication<ProjectSnapshotEvidence>(owner);
 const overview=useOwnedPortalPublication<import('@/components/projects/ProjectPage/tabs/ProjectOverviewSurface').ProjectOverviewEvidence>(owner);
 const controls=useOverviewControls(projectId),binding=useMemo(()=>({controls,publish:overview.publish}),[controls,overview.publish]);
 const navigation=useProjectTabSelection(projectId,props.tab,pending?undefined:props.snapshot?.project.hasJobPacks);
 const nav=useRef(navigation);nav.current=navigation;
 const select=useCallback((tab:Parameters<typeof navigation.selectTab>[0])=>nav.current.selectTab(tab),[]);
 const accessEnding=useCallback(()=>setDenied(true),[]);
 const retry=useCallback(()=>{setDenied(false);const url=new URL(window.location.href);url.searchParams.set('snapshotState','summary');window.history.replaceState(null,'',url);},[]);
 const evidence=publication.value?{...publication.value,overview:overview.value}:null;
 return <><PageLayout width="full" className={projectStyles.page} data-project-snapshot-state={denied?'unavailable':state}>
 <ProjectOverviewReadsProvider value={evidence?.overviewReads??null}>
 <ProjectPageFrameSurface header={<ProjectHeaderSurface projectId={projectId} project={evidence?.snapshot?.project??null} host={props.host} tab={props.tab} snapshotState={denied?'unavailable':state}
 readOnly={evidence?.readOnly??true} workModel={evidence?.snapshot?.workModel} projectWork={evidence?.projectWork} ownerControlsPaused={state!=='fresh'} tabAvailabilityReady={evidence?.snapshotContentReady??false}
 optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab} privateContentReady={Boolean(evidence)&&!denied} searchReader={null}/> }>
 <ProjectPageShellSurface projectId={projectId} snapshot={evidence?.snapshot??null} host={props.host} tab={props.tab} snapshotState={denied?'unavailable':state} snapshotContentReady={state==='fresh'}
 optimisticTab={navigation.optimisticTab} onTabSelect={navigation.selectTab} privateContentReady={Boolean(evidence)&&!denied} statusPanel={evidence?.statusPanel}
 publicBody={<><ProjectOverviewSurface controls={controls} evidence={denied?null:overview.value} unavailable={denied} onFiles={()=>{if(selectProjectView('files'))navigation.selectTab('files');}}/>{evidence&&!denied?evidence.body:null}</>}/>
 </ProjectPageFrameSurface></ProjectOverviewReadsProvider></PageLayout>
 {owner?<OverviewFixtureRead projectId={projectId} snapshot={props.snapshot} state={state} host={props.host} readOnly={props.readOnly??false} tab={navigation.activeTab} binding={binding} select={select} onAccessEnding={accessEnding} onRetry={retry} publish={publication.publish}/>:null}</>;
}
const OverviewFixtureRead=memo(function OverviewFixtureRead({projectId,snapshot,state,host,readOnly,tab,binding,select,onAccessEnding,onRetry,publish}:{projectId:string;snapshot:ProjectPageSnapshot|null;state:ProjectSnapshotLoadState;host:string;readOnly:boolean;tab:string;binding:OverviewBinding;select:ReturnType<typeof useProjectTabSelection>['selectTab'];onAccessEnding:()=>void;onRetry:()=>void;publish:(value:ProjectSnapshotEvidence|null)=>void}){
 const reads=useProjectOverviewReads(host,projectId,tab==='activity');
 const work=snapshot?currentProjectWork(snapshot,reads.commandQuery.data):undefined;
 const body=useMemo(()=> <ProjectCorrespondenceWarmRead projectId={projectId} enabled={tab==='activity'}><ProjectCommercialProvider projectId={projectId} work={work} ready={!readOnly&&Boolean(snapshot)&&state==='fresh'&&Boolean(work)}>
 <ProjectTabBody projectId={projectId} snapshot={snapshot} host={host} snapshotState={state} snapshotContentReady={state==='fresh'} readOnly={readOnly} tab={tab} overview={binding} onTabSelect={select} onProjectAccessEnding={onAccessEnding}/></ProjectCommercialProvider></ProjectCorrespondenceWarmRead>,[projectId,snapshot,state,host,readOnly,tab,binding,select,onAccessEnding,work]);
 const evidence=useMemo<ProjectSnapshotEvidence>(()=>({snapshot,host,readOnly,snapshotContentReady:state==='fresh',snapshotState:state,overviewReads:reads,calculatorWorkspace:false,projectWork:work,body,searchReader:null,onProjectAccessEnding:onAccessEnding,statusPanel:<ProjectSnapshotNotice state={state} onRetry={onRetry}/>} ),[snapshot,host,readOnly,state,reads,work,body,onAccessEnding,onRetry]);
 useLayoutEffect(()=>{publish(evidence);},[publish,evidence]);useLayoutEffect(()=>()=>publish(null),[publish]);return null;
});
