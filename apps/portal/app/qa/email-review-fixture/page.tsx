import { notFound } from 'next/navigation';
import FixtureClient from './FixtureClient';
export default async function EmailReviewFixturePage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}={}) {
  if (process.env.ENABLE_PORTAL_QA_FIXTURES?.trim() !== '1') notFound();
  const query=await searchParams;
  return <div data-portal-qa-fixture="email-review"><FixtureClient progressive={query?.progressive==='1'} failure={query?.readFailure==='1'} /></div>;
}
