import ContactsIndexClient from './ContactsIndexClient';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = await searchParams;
  const rawQuery = resolved?.q;
  const initialQuery = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? '';
  return <ContactsIndexClient initialQuery={initialQuery} />;
}
