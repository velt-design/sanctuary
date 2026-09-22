import { mutateReview } from '@/lib/emailReview/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {return mutateReview(request);}
