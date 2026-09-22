import { readReview } from '@/lib/emailReview/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {return readReview(request);}
