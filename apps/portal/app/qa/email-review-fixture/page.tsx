import { notFound } from 'next/navigation';
import FixtureClient from './FixtureClient';
export default function EmailReviewFixturePage() {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  return <div data-portal-qa-fixture="email-review"><FixtureClient /></div>;
}
