import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function toSearchString(searchParams: SearchParams | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') params.append(key, entry);
      }
      continue;
    }
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(`/login${toSearchString(resolvedSearchParams)}`);
}
