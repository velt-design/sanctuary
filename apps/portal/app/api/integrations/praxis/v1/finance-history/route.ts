import { financeHistoryResponse } from '../../../../../../lib/praxis/finance-history';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export const GET = (request: Request) => financeHistoryResponse(request);
