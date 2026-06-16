import ContactsIndexClient from './ContactsIndexClient';
import { loadContactsIndexData } from '@/lib/contacts/serverContactsIndex';

export default async function ContactsPage() {
  // PR-PG1 (2026-06-16): server-fetched contacts now arrive as
  // `{ rows, totalCount }` so the page can render a `ListCountBanner`
  // when the list approaches the silent-truncation ceiling. The bare
  // rows array still feeds the existing client (TanStack Query cache
  // shape unchanged); only the prop signature added.
  const { rows: initialContacts, totalCount: initialContactsTotalCount } = await loadContactsIndexData();
  return (
    <ContactsIndexClient
      initialContacts={initialContacts}
      initialContactsTotalCount={initialContactsTotalCount}
    />
  );
}
