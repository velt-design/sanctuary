import AccessStatusClient from './AccessStatusClient';
import { getSafeCallbackUrl, parseAccessStatusQueryState } from '@/lib/portalAccess';

type SearchParams = Record<string, string | string[] | undefined>;

function readFirst(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

export default async function AccessStatusPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const state = parseAccessStatusQueryState(readFirst(resolvedSearchParams?.state));
  const callbackUrl = getSafeCallbackUrl(readFirst(resolvedSearchParams?.callbackUrl), '/dashboard');

  return <AccessStatusClient state={state} callbackUrl={callbackUrl} />;
}
