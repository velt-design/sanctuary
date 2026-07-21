import { notFound } from 'next/navigation';
import UIFoundationCatalogue from '@/app/staff/ui-foundation/UIFoundationCatalogue';

function arePortalQaFixturesEnabled(): boolean {
  return process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() === '1';
}

export default function UIFoundationFixturePage() {
  if (!arePortalQaFixturesEnabled()) notFound();
  return <UIFoundationCatalogue />;
}
