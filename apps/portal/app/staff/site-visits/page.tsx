import SiteVisitsAgenda from '@/components/site-visits/SiteVisitsAgenda';
export default async function SiteVisitsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;const first=(key:string)=>typeof params[key]==='string'?params[key] as string:undefined;
  return <SiteVisitsAgenda projectId={first('project')} initialView={first('view')} initialPerson={first('person')} initialQuery={first('q')} />;
}
