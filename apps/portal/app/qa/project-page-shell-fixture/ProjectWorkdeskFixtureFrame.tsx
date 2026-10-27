'use client';

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useSearchParams } from 'next/navigation';
import ProjectSnapshotSurface, { type ProjectSnapshotEvidence } from '../../staff/projects/[projectId]/ProjectSnapshotSurface';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import { useProjectTabSelection } from '@/components/projects/ProjectPage/useProjectTabSelection';
import { useOwnedPortalPublication } from '@/components/page-state/PortalPageSource';
import { useOverviewControls } from '@/components/projects/ProjectPage/tabs/ProjectOverviewSurface';
import { useFilesControls } from '@/components/projects/ProjectPage/tabs/ProjectFilesSurface';
import { useCommercialListControls } from '@/components/projects/ProjectPage/tabs/CommercialTabSurface';
import { useQuotesListControls } from '@/components/projects/ProjectPage/tabs/QuotesListSurface';
import { useProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';
import { currentProjectWork } from '@/lib/projects/projectCurrentStatus';
import ProjectTabBody from '@/components/projects/ProjectPage/ProjectTabBody';
import ProjectSnapshotNotice from '@/components/projects/ProjectPage/ProjectSnapshotNotice';
import { ProjectCommercialProvider } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import ProjectHeaderOwnerControl from '@/components/projects/ProjectPage/ProjectHeaderOwnerControl';
import ProjectHeaderPrivateActions from '@/components/projects/ProjectPage/ProjectHeaderPrivateActions';
import type { ProjectSnapshotLoadState } from '@/lib/projects/types';

type Props=Omit<ComponentProps<typeof ProjectPageFrame>, 'optimisticTab'|'onTabSelect'>;

/** The fixture supplies controlled sources to the unchanged production frame/controllers. */
export default function ProjectWorkdeskFixtureFrame(props:Props){
  const params=useSearchParams();
  const requested=params.get('snapshotState');
  const [denied,setDenied]=useState(false);
  const state:ProjectSnapshotLoadState=requested==='pending'||requested==='summary'||requested==='refresh-failed'?requested:'fresh';
  const projectId=props.projectId??props.snapshot?.project.id??'';
  const owner=useMemo(()=>state==='pending'||denied?null:{},[projectId,state,denied]);
  const snapshot=useOwnedPortalPublication<ProjectSnapshotEvidence>(owner);
  const overview=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['overview']>>(owner);
  const files=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['files']>>(owner);
  const estimates=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['estimatesList']>>(owner);
  const quotes=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['quotesList']>>(owner);
  const invoices=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['invoicesList']>>(owner);
  const commercial=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['commercial']>>(owner);
  const jobPacks=useOwnedPortalPublication<NonNullable<ProjectSnapshotEvidence['jobPacks']>>(owner);
  const overviewControls=useOverviewControls(projectId),filesControls=useFilesControls(projectId);
  const estimatesControls=useCommercialListControls(projectId),quotesControls=useQuotesListControls(projectId),invoicesControls=useCommercialListControls(projectId);
  const navigation=useProjectTabSelection(projectId,props.tab,props.snapshot?.project.hasJobPacks);
  const nav=useRef(navigation);nav.current=navigation;
  const select=useCallback((tab:Parameters<typeof navigation.selectTab>[0])=>nav.current.selectTab(tab),[]);
  const onAccessEnding=useCallback(()=>setDenied(true),[]);
  const onRetry=useCallback(()=>{setDenied(false);const url=new URL(window.location.href);url.searchParams.set('snapshotState','fresh');window.history.replaceState(null,'',url);},[]);
  const bindings=useMemo(()=>({
    overview:{controls:overviewControls,publish:overview.publish},files:{controls:filesControls,publish:files.publish},
    estimatesList:{controls:estimatesControls,publish:estimates.publish},quotesList:{controls:quotesControls,publish:quotes.publish},
    invoicesList:{controls:invoicesControls,publish:invoices.publish},publishCommercial:commercial.publish,publishJobPacks:jobPacks.publish,
  }),[overviewControls,filesControls,estimatesControls,quotesControls,invoicesControls,overview.publish,files.publish,estimates.publish,quotes.publish,invoices.publish,commercial.publish,jobPacks.publish]);
  const evidence=snapshot.value?{...snapshot.value,overview:overview.value,files:files.value,estimatesList:estimates.value,quotesList:quotes.value,invoicesList:invoices.value,commercial:commercial.value,jobPacks:jobPacks.value}:null;
  return <>
    <ProjectSnapshotSurface projectId={projectId} tab={props.tab} evidence={evidence} navigation={navigation} unavailable={denied} onRetry={onRetry}
      overviewControls={overviewControls} filesControls={filesControls} estimatesListControls={estimatesControls} quotesListControls={quotesControls} invoicesListControls={invoicesControls}/>
    {owner?<WorkdeskRead props={props} state={state} projectId={projectId} tab={navigation.activeTab} bindings={bindings} publish={snapshot.publish} onAccessEnding={onAccessEnding} onRetry={onRetry} onSelect={select}/>:null}
  </>;
}

const WorkdeskRead=memo(function WorkdeskRead({props,state,projectId,tab,bindings,publish,onAccessEnding,onRetry,onSelect}:{
  props:Props;state:ProjectSnapshotLoadState;projectId:string;tab:string;
  bindings:Pick<ComponentProps<typeof ProjectTabBody>,'overview'|'files'|'estimatesList'|'quotesList'|'invoicesList'|'publishCommercial'|'publishJobPacks'>;
  publish:(value:ProjectSnapshotEvidence|null)=>void;onAccessEnding:()=>void;onRetry:()=>void;onSelect:NonNullable<ComponentProps<typeof ProjectTabBody>['onTabSelect']>;
}){
  const reads=useProjectOverviewReads(props.host,projectId,tab==='activity');
  const work=props.snapshot?currentProjectWork(props.snapshot,reads.commandQuery.data):undefined;
  const body=useMemo(()=><ProjectCommercialProvider projectId={projectId} work={work} ready={state==='fresh'&&Boolean(work)}>
    <ProjectTabBody {...bindings} snapshot={props.snapshot} projectId={projectId} host={props.host} tab={tab} snapshotState={state} snapshotContentReady={state==='fresh'} readOnly={state!=='fresh'} onTabSelect={onSelect} onProjectAccessEnding={onAccessEnding}/>
  </ProjectCommercialProvider>,[bindings,props.snapshot,props.host,projectId,tab,state,work,onAccessEnding,onSelect]);
  const evidence=useMemo<ProjectSnapshotEvidence>(()=>({snapshot:props.snapshot,host:props.host,readOnly:state!=='fresh',snapshotState:state,snapshotContentReady:state==='fresh',overviewReads:reads,calculatorWorkspace:false,projectWork:work,body,searchReader:null,onProjectAccessEnding:onAccessEnding,statusPanel:<ProjectSnapshotNotice state={state} onRetry={onRetry}/>,
    headerOwner:<ProjectHeaderOwnerControl project={props.snapshot?.project??null} projectId={projectId} host={props.host} active={tab==='activity'} expectedWorkModel={props.snapshot?.workModel} externallyPaused={state!=='fresh'}/>,
    headerActions:<ProjectHeaderPrivateActions project={props.snapshot?.project??null} projectId={projectId} disabled={state!=='fresh'}/>,
  }),[props.snapshot,props.host,projectId,tab,state,reads,work,body,onAccessEnding,onRetry]);
  useLayoutEffect(()=>{publish(evidence);},[publish,evidence]);
  useLayoutEffect(()=>()=>publish(null),[publish]);
  return null;
});
