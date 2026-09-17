import { qualificationRequest } from '@/lib/projects/qualification/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ projectId: string; enquiryId: string }> };
export function GET(request: Request, context: Context) { return qualificationRequest(request, context, false); }
export function POST(request: Request, context: Context) { return qualificationRequest(request, context, true); }
