import GuardedGlobalPortalSearch from '@/components/layout/GuardedGlobalPortalSearch';
import { requireStaffPageAccess } from '@/lib/auth';
import ContactsIndexClient from './GuardedContactsIndexClient';
import { PortalGuardedPage } from '@/components/page-state/PortalPageSource';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireStaffPageAccess('/staff/contacts');
  const resolved = await searchParams;
  const rawQuery = resolved?.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? '';
  return <PortalGuardedPage pathname="/staff/contacts" completion={{}}>
    <GuardedGlobalPortalSearch/>
    <ContactsIndexClient initialQuery={initialQuery} />
  </PortalGuardedPage>;
}
