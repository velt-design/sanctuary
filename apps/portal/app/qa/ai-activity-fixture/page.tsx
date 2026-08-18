import { notFound } from 'next/navigation';
import AiActivityView from '@/components/ai/AiActivityView';
import {
  aiActivityFixtureDetail,
  aiActivityFixtureTasks,
} from './fixtures';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function AiActivityFixturePage() {
  if (!arePortalQaFixturesEnabled()) notFound();

  return (
    <div data-portal-qa-fixture="ai-activity">
      <AiActivityView tasks={aiActivityFixtureTasks} detail={aiActivityFixtureDetail} />
    </div>
  );
}
