import { saveVisitDetails } from '@/lib/siteVisits/correctionHttp';
export const runtime='nodejs';
export const POST=(request:Request)=>saveVisitDetails(request);
