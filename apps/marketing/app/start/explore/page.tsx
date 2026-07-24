import StartExploreClient from './StartExploreClient';

type SearchParams = Record<string, string | string[] | undefined>;

function readBoolParam(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s === '1' || s === 'true';
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const debug = readBoolParam(params?.debug);
  return <StartExploreClient debug={debug} />;
}
