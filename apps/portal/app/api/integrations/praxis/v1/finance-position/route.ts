import { financePositionResponse } from '@/lib/praxis/finance-position';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) { return financePositionResponse(request); }
