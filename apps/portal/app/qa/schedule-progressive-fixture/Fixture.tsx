'use client';
import { useMemo } from 'react';
import ScheduleClient from '@/app/staff/schedule/ScheduleClient';
import type { SchedulePageSeed } from '@/lib/scheduling/serverSchedulePageSeed';
import { progressiveScheduleSnapshot } from './snapshot';

export default function Fixture({initialSeed,view}:{initialSeed:Promise<SchedulePageSeed|null>;view:'board'|'gantt'}) {
  const snapshotLoaders = useMemo(() => {
    let failuresLeft = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('failure') === '1' ? 2 : 0;
    const read = async (signal: AbortSignal) => {
      await new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,1200);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Aborted'));},{once:true});});
      if(failuresLeft>0){failuresLeft-=1;throw new Error('Synthetic schedule read failure. Retry uses the same fictional source.');}
      return progressiveScheduleSnapshot();
    };
    return {board:read,gantt:read};
  },[]);
  return <><span hidden data-progressive-schedule-fixture="fictional"/><ScheduleClient navigationPath="/qa/schedule-progressive-fixture" initialSeedKind={view} initialSeed={initialSeed} snapshotLoaders={snapshotLoaders}/></>;
}
