import { notFound } from 'next/navigation';
import { resolveScheduleTodayYmd } from '@/lib/scheduling/scheduleClock';
import { resolveDefaultScheduleGanttRange } from '@/lib/scheduling/scheduleGanttRange';
import type { SchedulePageSeed } from '@/lib/scheduling/serverSchedulePageSeed';
import { progressiveScheduleSnapshot } from './snapshot';
import Fixture from './Fixture';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if(process.env.ENABLE_PORTAL_QA_FIXTURES?.trim()!=='1'||(process.env.NODE_ENV==='production'&&process.env.VERCEL_ENV!=='preview'))notFound();
  const query=await searchParams,view=query.view==='gantt'?'gantt':'board',today=resolveScheduleTodayYmd();
  const initialSeed:Promise<SchedulePageSeed|null>=new Promise(resolve=>setTimeout(()=>resolve(query.failure==='1'?null:{initialScheduleMode:'v2',initialSeedKind:view,today,...(view==='gantt'?resolveDefaultScheduleGanttRange(today):{}),initialV2Snapshot:progressiveScheduleSnapshot()}),1800));
  return <Fixture initialSeed={initialSeed} view={view}/>;
}
