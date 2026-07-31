import { notFound } from 'next/navigation';
import ScheduleOpsFixtureClient from './ScheduleOpsFixtureClient';
import type { ScheduleBoardChangePhase } from '@/app/staff/schedule/useScheduleBoardChangeFeedback';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default async function ScheduleOpsFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; scale?: string; state?: string }>;
}) {
  if (!arePortalQaFixturesEnabled()) notFound();
  const params = await searchParams;
  const initialView = params.view === 'gantt' ? 'gantt' : 'board';
  const scale = params.scale === 'large' ? 'large' : 'standard';
  const supportedStates = new Set<ScheduleBoardChangePhase>([
    'checking',
    'reviewing',
    'saving',
    'reconciling',
    'saved',
    'restored',
    'verified',
  ]);
  const initialState = supportedStates.has(params.state as ScheduleBoardChangePhase)
    ? params.state as ScheduleBoardChangePhase
    : null;

  return (
    <main data-portal-qa-fixture="schedule-ops">
      <ScheduleOpsFixtureClient initialView={initialView} scale={scale} initialState={initialState} />
    </main>
  );
}
